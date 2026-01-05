/**
 * Endpoint para deletar leads "Contato" - USE COM CUIDADO!
 * 
 * Acesse: https://seu-dominio.vercel.app/api/cleanup-contato-leads?confirm=SIM_DELETAR
 * 
 * ATENÇÃO: Esta operação é IRREVERSÍVEL!
 */

import admin from 'firebase-admin';

// Inicializar Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    console.log('✅ Firebase Admin inicializado');
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin:', error);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use GET.'
    });
  }

  try {
    const { confirm } = req.query;

    console.log('🔍 Buscando leads que começam com "Contato"...');
    
    // Buscar todos os leads
    const leadsSnapshot = await db.collection('leads').get();
    
    const toDelete = [];
    const examples = [];
    
    leadsSnapshot.forEach((doc) => {
      const data = doc.data();
      const nomePackiente = data.nomePackiente || data.nome_paciente || '';
      const telefone = data.telefone || '';
      
      // Verificar se começa com "Contato" ou telefone começa com "ID-"
      if (nomePackiente.startsWith('Contato') || telefone.startsWith('ID-')) {
        toDelete.push({
          id: doc.id,
          nome: nomePackiente,
          telefone: telefone
        });
        
        // Guardar primeiros 20 exemplos
        if (examples.length < 20) {
          examples.push({
            nome: nomePackiente,
            telefone: telefone,
            email: data.email || 'N/A',
            dataRegistro: data.dataRegistroContato || data.createdAt
          });
        }
      }
    });

    console.log(`📊 Total de leads: ${leadsSnapshot.size}`);
    console.log(`🗑️  Leads "Contato" encontrados: ${toDelete.length}`);

    // MODO PREVIEW (padrão) - Apenas mostra o que seria deletado
    if (!confirm || confirm !== 'SIM_DELETAR') {
      return res.status(200).json({
        success: true,
        mode: 'PREVIEW',
        message: '⚠️ MODO PREVIEW - Nenhum dado foi deletado',
        stats: {
          totalLeads: leadsSnapshot.size,
          leadsToDelete: toDelete.length
        },
        examples: examples,
        warning: '🔥 Para DELETAR de verdade, adicione ?confirm=SIM_DELETAR na URL',
        fullUrl: `https://${req.headers.host}/api/cleanup-contato-leads?confirm=SIM_DELETAR`
      });
    }

    // MODO DELETE - Deletar de verdade
    console.log('🔥 MODO DELETE ATIVADO - Iniciando deleção...');

    if (toDelete.length === 0) {
      return res.status(200).json({
        success: true,
        mode: 'DELETE',
        message: '✅ Nenhum lead "Contato" encontrado para deletar',
        stats: {
          totalLeads: leadsSnapshot.size,
          deleted: 0
        }
      });
    }

    let deleted = 0;
    const errors = [];
    
    // Deletar em lotes de 500 (limite do Firestore)
    const batchSize = 500;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = db.batch();
      const batchLeads = toDelete.slice(i, i + batchSize);
      
      for (const lead of batchLeads) {
        try {
          const docRef = db.collection('leads').doc(lead.id);
          batch.delete(docRef);
        } catch (error) {
          console.error(`❌ Erro ao adicionar ao batch lead ${lead.id}:`, error);
          errors.push({
            leadId: lead.id,
            error: error.message
          });
        }
      }
      
      try {
        await batch.commit();
        deleted += batchLeads.length;
        console.log(`✅ ${deleted} leads deletados...`);
      } catch (error) {
        console.error('❌ Erro ao executar batch:', error);
        errors.push({
          batch: i,
          error: error.message
        });
      }
    }

    console.log(`🎉 Limpeza concluída! ${deleted} leads deletados`);

    return res.status(200).json({
      success: true,
      mode: 'DELETE',
      message: `✅ Limpeza concluída com sucesso!`,
      stats: {
        totalLeads: leadsSnapshot.size,
        deleted: deleted,
        errors: errors.length
      },
      deletedExamples: examples.slice(0, 10),
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Erro durante limpeza:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar limpeza',
      details: error.message
    });
  }
}
