/**
 * Auditoria e reparo da coleção 'leads' (dados corrompidos pelo antigo bug de
 * update parcial que sobrescrevia o documento com defaults vazios).
 *
 * Endpoints (exigem ADMIN_API_SECRET via ?secret= ou header x-admin-secret):
 *   GET /api/admin-audit-leads                -> RELATÓRIO (read-only)
 *   GET /api/admin-audit-leads?repair=true    -> aplica reparos SEGUROS:
 *       - dataRegistroContato ausente  -> preenchido com createdAt (lead volta a aparecer na lista)
 *       - dataRegistroContato não-string -> normalizado para ISO string
 *       - totalVisitas/valorTotalVisitas/primeira/ultimaVisita divergentes do
 *         array historicoVisitas -> recalculados
 *       - nomePackiente vazio + digisacContactId presente -> tenta recuperar
 *         nome/telefone na API do Digisac (se DIGISAC_API_TOKEN configurado)
 *
 * Nunca deleta nada. Leads com nome vazio e sem origem Digisac são apenas listados.
 */

import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error);
  }
}

const db = admin.firestore();

function checkAdminSecret(req, res) {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'Endpoint desabilitado: configure ADMIN_API_SECRET nas variáveis de ambiente do Vercel.' });
    return false;
  }
  const provided = req.headers['x-admin-secret'] || req.query.secret;
  if (provided !== secret) {
    res.status(401).json({ error: 'Não autorizado.' });
    return false;
  }
  return true;
}

const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '';

async function fetchDigisacContact(contactId) {
  const apiToken = process.env.DIGISAC_API_TOKEN;
  if (!apiToken || !contactId) return null;
  const apiUrl = (process.env.DIGISAC_API_URL || 'https://api.digisac.com.br').replace(/\/api\/v1\/?$/, '');
  try {
    const response = await fetch(`${apiUrl}/api/v1/contacts/${contactId}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const contact = data.contact || data;
    let phone = '';
    if (contact.data && contact.data.number) phone = contact.data.number;
    else if (contact.idFromService && contact.idFromService.includes('@')) phone = contact.idFromService.split('@')[0];
    else phone = contact.phone || contact.number || '';
    return { name: contact.internalName || contact.name || '', phone: String(phone || '') };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });
  if (!checkAdminSecret(req, res)) return;

  const repair = req.query.repair === 'true';

  try {
    const snapshot = await db.collection('leads').get();

    const report = {
      total: snapshot.size,
      semDataRegistro: [],
      dataRegistroNaoString: [],
      nomeVazio: [],
      nomeVazioComDigisac: [],
      telefoneVazio: [],
      contadoresInconsistentes: [],
      orfaosDigisac: [],
      statusDistribuicao: {},
      duplicadosPorTelefone: 0,
    };
    const phoneMap = new Map();
    const repairs = [];

    snapshot.forEach((doc) => {
      const d = doc.data();
      const nome = d.nomePackiente ?? d.nomePaciente ?? d.nome_paciente;
      const hv = Array.isArray(d.historicoVisitas) ? d.historicoVisitas : [];
      const info = { id: doc.id, nome: nome || '(vazio)', telefone: d.telefone || '' };

      report.statusDistribuicao[d.status || '(sem status)'] = (report.statusDistribuicao[d.status || '(sem status)'] || 0) + 1;

      const update = {};

      if (d.dataRegistroContato === undefined) {
        report.semDataRegistro.push(info);
        const createTime = doc.createTime ? doc.createTime.toDate().toISOString() : new Date().toISOString();
        update.dataRegistroContato = createTime;
      } else if (typeof d.dataRegistroContato !== 'string') {
        report.dataRegistroNaoString.push(info);
        const parsed = d.dataRegistroContato?.toDate
          ? d.dataRegistroContato.toDate()
          : new Date(d.dataRegistroContato);
        if (!isNaN(parsed?.getTime?.())) update.dataRegistroContato = parsed.toISOString();
      }

      if (isEmpty(nome)) {
        report.nomeVazio.push(info);
        if (d.digisacContactId) report.nomeVazioComDigisac.push({ ...info, digisacContactId: d.digisacContactId });
      }
      if (isEmpty(d.telefone)) report.telefoneVazio.push(info);

      const tv = d.totalVisitas || 0;
      if (tv !== hv.length) {
        report.contadoresInconsistentes.push({ ...info, totalVisitas: tv, visitasReais: hv.length });
        const valores = hv.map(v => parseFloat(v.valor) || 0);
        const datas = hv.map(v => v.dataVisita).filter(Boolean).sort();
        update.totalVisitas = hv.length;
        update.valorTotalVisitas = valores.reduce((a, b) => a + b, 0);
        update.primeiraVisita = datas[0] || '';
        update.ultimaVisita = datas[datas.length - 1] || '';
      }

      if (typeof d.telefone === 'string' && d.telefone.startsWith('ID-')) report.orfaosDigisac.push(info);

      const cleanPhone = String(d.telefone || '').replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        if (phoneMap.has(cleanPhone)) report.duplicadosPorTelefone++;
        else phoneMap.set(cleanPhone, doc.id);
      }

      if (Object.keys(update).length > 0) {
        repairs.push({ id: doc.id, update, digisacContactId: isEmpty(nome) ? d.digisacContactId : null });
      } else if (isEmpty(nome) && d.digisacContactId) {
        repairs.push({ id: doc.id, update: {}, digisacContactId: d.digisacContactId });
      }
    });

    const resumo = {
      total: report.total,
      semDataRegistro: report.semDataRegistro.length,
      dataRegistroNaoString: report.dataRegistroNaoString.length,
      nomeVazio: report.nomeVazio.length,
      nomeVazioRecuperavelViaDigisac: report.nomeVazioComDigisac.length,
      telefoneVazio: report.telefoneVazio.length,
      contadoresInconsistentes: report.contadoresInconsistentes.length,
      orfaosDigisac: report.orfaosDigisac.length,
      duplicadosPorTelefone: report.duplicadosPorTelefone,
    };

    if (!repair) {
      return res.status(200).json({
        dryRun: true,
        message: 'Relatório de auditoria (nada foi alterado). Adicione &repair=true para aplicar reparos seguros.',
        resumo,
        statusDistribuicao: report.statusDistribuicao,
        detalhes: {
          semDataRegistro: report.semDataRegistro.slice(0, 50),
          dataRegistroNaoString: report.dataRegistroNaoString.slice(0, 50),
          nomeVazio: report.nomeVazio.slice(0, 50),
          telefoneVazio: report.telefoneVazio.slice(0, 50),
          contadoresInconsistentes: report.contadoresInconsistentes.slice(0, 50),
          orfaosDigisac: report.orfaosDigisac.slice(0, 50),
        },
      });
    }

    // ===== MODO REPARO =====
    let reparados = 0;
    let nomesRecuperados = 0;
    const erros = [];

    for (const r of repairs) {
      try {
        const update = { ...r.update };

        if (r.digisacContactId) {
          const contact = await fetchDigisacContact(r.digisacContactId);
          if (contact && contact.name) {
            update.nomePackiente = contact.name;
            if (contact.phone) update.telefone = contact.phone;
            nomesRecuperados++;
          }
        }

        if (Object.keys(update).length > 0) {
          await db.collection('leads').doc(r.id).update(update);
          reparados++;
        }
      } catch (err) {
        erros.push({ id: r.id, erro: err.message });
      }
    }

    return res.status(200).json({
      dryRun: false,
      message: `Reparo concluído: ${reparados} leads atualizados (${nomesRecuperados} nomes recuperados via Digisac).`,
      resumo,
      reparados,
      nomesRecuperados,
      erros: erros.length > 0 ? erros : undefined,
    });
  } catch (error) {
    console.error('Erro na auditoria de leads:', error);
    return res.status(500).json({ error: error.message });
  }
}
