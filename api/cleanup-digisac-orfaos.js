/**
 * Remove os leads "órfãos" criados pela integração Digisac quando a API
 * retornou erro (ex.: 401 por token inválido) e o webhook caiu no fallback.
 *
 * Assinatura do lixo: telefone começa com "ID-" (ex.: "ID-12e1c472-...")
 * e nome no formato "Contato <8 chars>".
 *
 * Endpoint:
 *   GET /api/cleanup-digisac-orfaos              -> DRY RUN (apenas lista)
 *   GET /api/cleanup-digisac-orfaos?confirm=true -> deleta de verdade
 *
 * Sempre rode primeiro SEM ?confirm=true para conferir a lista.
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

// SEGURANÇA: endpoint destrutivo — exige segredo compartilhado.
// Sem ADMIN_API_SECRET configurado no Vercel, o endpoint fica DESABILITADO.
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET' });
  }

  if (!checkAdminSecret(req, res)) return;

  const confirmDelete = req.query.confirm === 'true';

  try {
    // Prefix match no campo telefone: tudo que começa com "ID-".
    //  e o maior code point usavel como limite superior no Firestore.
    const PREFIX = 'ID-';
    const snapshot = await db.collection('leads')
      .where('telefone', '>=', PREFIX)
      .where('telefone', '<', PREFIX + '')
      .get();

    const orfaos = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      orfaos.push({
        id: doc.id,
        nome: d.nomePaciente || d.nome_paciente || d.nomePackiente || '',
        telefone: d.telefone || '',
      });
    });

    if (!confirmDelete) {
      return res.status(200).json({
        dryRun: true,
        total: orfaos.length,
        message: `${orfaos.length} leads orfaos encontrados. Adicione ?confirm=true para deletar.`,
        leads: orfaos,
      });
    }

    // Delecao em lotes de 400 (limite do batch do Firestore e 500)
    let deletados = 0;
    for (let i = 0; i < orfaos.length; i += 400) {
      const batch = db.batch();
      orfaos.slice(i, i + 400).forEach(l => {
        batch.delete(db.collection('leads').doc(l.id));
      });
      await batch.commit();
      deletados += Math.min(400, orfaos.length - i);
    }

    return res.status(200).json({
      dryRun: false,
      deletados,
      message: `${deletados} leads orfaos do Digisac removidos.`,
    });
  } catch (error) {
    console.error('Erro no cleanup-digisac-orfaos:', error);
    return res.status(500).json({ error: error.message });
  }
}
