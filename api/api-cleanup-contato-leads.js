/**
 * Endpoint para remover leads duplicados baseado no telefone - USE COM CUIDADO!
 * 
 * Acesse: https://seu-dominio.vercel.app/api/cleanup-contato-leads?confirm=SIM_DELETAR
 * 
 * ATENÇÃO: Esta operação é IRREVERSÍVEL!
 * 
 * Funcionalidade:
 * - Agrupa leads pelo número de telefone
 * - Mantém o lead mais recente de cada grupo
 * - Deleta os leads duplicados mais antigos
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

// Função para normalizar telefone (remover formatação)
function normalizarTelefone(telefone) {
  if (!telefone) return '';
  return telefone.replace(/\D/g, ''); // Remove tudo que não é número
}

// Função para obter data de registro
function getDataRegistro(data) {
  if (data.dataRegistroContato) {
    return new Date(data.dataRegistroContato);
  }
  if (data.createdAt && data.createdAt._seconds) {
    return new Date(data.createdAt._seconds * 1000);
  }
  if (data.createdAt) {
    return new Date(data.createdAt);
  }
  return new Date(0); // Data muito antiga como fallback
}

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

    console.log('🔍 Buscando leads duplicados por telefone...');
    
    // Buscar todos os leads
    const leadsSnapshot = await db.collection('leads').get();
    
    // Agrupar leads por telefone normalizado
    const leadsPorTelefone = new Map();
    
    leadsSnapshot.forEach((doc) => {
      const data = doc.data();
      const telefone = data.telefone || '';
      const telefoneNormalizado = normalizarTelefone(telefone);
      
      // Ignorar leads sem telefone ou com telefone inválido
      if (!telefoneNormalizado || telefoneNormalizado.length < 8) {
        return;
      }
      
      const leadInfo = {
        id: doc.id,
        nome: data.nomePackiente || data.nome_paciente || '',
        telefone: telefone,
        telefoneNormalizado: telefoneNormalizado,
        email: data.email || '',
        dataRegistro: getDataRegistro(data),
        status: data.status || '',
        data: data
      };
      
      if (!leadsPorTelefone.has(telefoneNormalizado)) {
        leadsPorTelefone.set(telefoneNormalizado, []);
      }
      
      leadsPorTelefone.get(telefoneNormalizado).push(leadInfo);
    });
    
    // Identificar duplicados (telefones com mais de 1 lead)
    const toDelete = [];
    const examples = [];
    const gruposDuplicados = [];
    
    leadsPorTelefone.forEach((leads, telefone) => {
      if (leads.length > 1) {
        // Ordenar por data (mais recente primeiro)
        leads.sort((a, b) => b.dataRegistro - a.dataRegistro);
        
        const maisRecente = leads[0];
        const duplicados = leads.slice(1); // Todos menos o mais recente
        
        // Adicionar informações do grupo
        gruposDuplicados.push({
          telefone: maisRecente.telefone,
          totalDuplicados: leads.length,
          maisRecente: {
            id: maisRecente.id,
            nome: maisRecente.nome,
            dataRegistro: maisRecente.dataRegistro.toISOString(),
            status: maisRecente.status
          },
          duplicados: duplicados.map(d => ({
            id: d.id,
            nome: d.nome,
            dataRegistro: d.dataRegistro.toISOString(),
            status: d.status
          }))
        });
        
        // Adicionar duplicados para deleção
        duplicados.forEach(lead => {
          toDelete.push({
            id: lead.id,
            nome: lead.nome,
            telefone: lead.telefone,
            dataRegistro: lead.dataRegistro
          });
        });
        
        // Guardar exemplos (primeiros 20 grupos)
        if (examples.length < 20) {
          examples.push({
            telefone: maisRecente.telefone,
            totalDuplicados: leads.length,
            leadMantido: {
              nome: maisRecente.nome,
              dataRegistro: maisRecente.dataRegistro.toISOString(),
              status: maisRecente.status
            },
            leadsRemovidos: duplicados.map(d => ({
              nome: d.nome,
              dataRegistro: d.dataRegistro.toISOString(),
              status: d.status
            }))
          });
        }
      }
    });

    console.log(`📊 Total de leads: ${leadsSnapshot.size}`);
    console.log(`📞 Total de telefones únicos: ${leadsPorTelefone.size}`);
    console.log(`🔄 Grupos com duplicados: ${gruposDuplicados.length}`);
    console.log(`🗑️  Leads duplicados a remover: ${toDelete.length}`);

    // MODO PREVIEW (padrão) - Apenas mostra o que seria deletado
    if (!confirm || confirm !== 'SIM_DELETAR') {
      return res.status(200).json({
        success: true,
        mode: 'PREVIEW',
        message: '⚠️ MODO PREVIEW - Nenhum dado foi deletado',
        stats: {
          totalLeads: leadsSnapshot.size,
          telefonesUnicos: leadsPorTelefone.size,
          gruposComDuplicados: gruposDuplicados.length,
          leadsToDelete: toDelete.length,
          leadsMantidos: leadsSnapshot.size - toDelete.length
        },
        examples: examples,
        warning: '🔥 Para DELETAR de verdade, adicione ?confirm=SIM_DELETAR na URL',
        fullUrl: `https://${req.headers.host}/api/cleanup-contato-leads?confirm=SIM_DELETAR`,
        description: 'Esta API remove leads duplicados baseado no telefone, mantendo sempre o mais recente de cada grupo.'
      });
    }

    // MODO DELETE - Deletar de verdade
    console.log('🔥 MODO DELETE ATIVADO - Iniciando deleção de duplicados...');

    if (toDelete.length === 0) {
      return res.status(200).json({
        success: true,
        mode: 'DELETE',
        message: '✅ Nenhum lead duplicado encontrado',
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
            leadNome: lead.nome,
            error: error.message
          });
        }
      }
      
      try {
        await batch.commit();
        deleted += batchLeads.length;
        console.log(`✅ ${deleted}/${toDelete.length} leads duplicados deletados...`);
      } catch (error) {
        console.error('❌ Erro ao executar batch:', error);
        errors.push({
          batch: i,
          error: error.message
        });
      }
    }

    console.log(`🎉 Limpeza de duplicados concluída! ${deleted} leads removidos`);

    return res.status(200).json({
      success: true,
      mode: 'DELETE',
      message: `✅ Limpeza de duplicados concluída com sucesso!`,
      stats: {
        totalLeads: leadsSnapshot.size,
        gruposComDuplicados: gruposDuplicados.length,
        deleted: deleted,
        leadsMantidos: leadsSnapshot.size - deleted,
        errors: errors.length
      },
      examples: examples.slice(0, 10),
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Erro durante limpeza de duplicados:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar limpeza de duplicados',
      details: error.message
    });
  }
}
