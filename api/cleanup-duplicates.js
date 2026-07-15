/**
 * Script para remover leads duplicados do Firestore
 * Mantém apenas o lead mais antigo (primeiro criado) para cada telefone
 *
 * Endpoint: GET /api/cleanup-duplicates?confirm=true
 *
 * Sem ?confirm=true: apenas lista os duplicados (dry run)
 * Com ?confirm=true: deleta os duplicados
 *
 * OTIMIZADO: usa select() para trazer apenas campos necessários (1 leitura por doc)
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

function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

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
    // Trazer APENAS telefone, nome e data - reduz bandwidth, mesmas leituras
    const snapshot = await db.collection('leads')
      .select('telefone', 'nomePackiente', 'dataRegistroContato', 'createdAt')
      .get();

    const leads = [];
    snapshot.forEach(doc => {
      leads.push({ id: doc.id, ...doc.data() });
    });

    // Agrupar por telefone normalizado
    const phoneGroups = {};

    leads.forEach(lead => {
      const phone = normalizePhone(lead.telefone || '');
      if (!phone || phone.length < 10) return;

      if (!phoneGroups[phone]) {
        phoneGroups[phone] = [];
      }
      phoneGroups[phone].push(lead);
    });

    // Encontrar duplicados
    const duplicates = [];
    const toDelete = [];

    for (const [phone, group] of Object.entries(phoneGroups)) {
      if (group.length > 1) {
        // Ordenar por data de criação (mais antigo primeiro)
        group.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.dataRegistroContato || 0);
          const dateB = b.createdAt?.toDate?.() || new Date(b.dataRegistroContato || 0);
          return dateA - dateB;
        });

        const keep = group[0];
        const remove = group.slice(1);

        duplicates.push({
          phone,
          total: group.length,
          keeping: { id: keep.id, name: keep.nomePackiente },
          removing: remove.map(l => ({ id: l.id, name: l.nomePackiente }))
        });

        toDelete.push(...remove);
      }
    }

    if (confirmDelete && toDelete.length > 0) {
      // Deletar em batches de 500 (limite do Firestore)
      let deleted = 0;

      for (let i = 0; i < toDelete.length; i += 500) {
        const batch = db.batch();
        const chunk = toDelete.slice(i, i + 500);

        chunk.forEach(lead => {
          batch.delete(db.collection('leads').doc(lead.id));
        });

        await batch.commit();
        deleted += chunk.length;
      }

      return res.status(200).json({
        success: true,
        message: `${deleted} leads duplicados removidos`,
        totalBefore: leads.length,
        totalAfter: leads.length - deleted,
        duplicateGroups: duplicates.length,
        deleted
      });
    }

    return res.status(200).json({
      success: true,
      dryRun: !confirmDelete,
      message: !confirmDelete ? 'Adicione ?confirm=true para deletar' : 'Nenhum duplicado encontrado',
      totalLeads: leads.length,
      duplicateGroups: duplicates.length,
      leadsToDelete: toDelete.length,
      leadsAfterCleanup: leads.length - toDelete.length,
      details: duplicates.slice(0, 50)
    });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
