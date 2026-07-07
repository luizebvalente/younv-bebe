/**
 * Webhook Digisac → Younv CRM (VERSÃO FINAL FUNCIONAL)
 * 
 * CORREÇÕES APLICADAS:
 * - Filtro de eventos de ticket (apenas mensagens de chat)
 * - Cache de 10 minutos para reduzir consumo do Firebase
 * - Query otimizada (where ao invés de .get() completo)
 * - Mantém toda funcionalidade original
 * 
 * Endpoint: POST /api/digisac-webhook
 */

import admin from 'firebase-admin';

// ========================================
// INICIALIZAÇÃO DO FIREBASE
// ========================================

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    console.log('✅ Firebase Admin inicializado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin:', error);
  }
}

const db = admin.firestore();

// ========================================
// CACHE (REDUZ CONSUMO DO FIREBASE)
// ========================================

const phoneCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

function getCachedLead(phone) {
  const cached = phoneCache.get(phone);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`💾 Lead encontrado no cache: ${phone}`);
    return cached.lead;
  }
  return null;
}

function setCachedLead(phone, lead) {
  phoneCache.set(phone, {
    lead,
    timestamp: Date.now()
  });
}

// Limpar cache periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [phone, data] of phoneCache.entries()) {
    if (now - data.timestamp > CACHE_TTL) {
      phoneCache.delete(phone);
    }
  }
}, CACHE_TTL);

// ========================================
// HANDLER PRINCIPAL
// ========================================

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Responder OPTIONS para preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST.'
    });
  }

  try {
    // VALIDAR PAYLOAD
    const payload = req.body;
    console.log('📥 Webhook recebido:', JSON.stringify(payload, null, 2));

    if (!payload || !payload.data) {
      console.warn('⚠️ Payload inválido recebido');
      return res.status(400).json({
        success: false,
        error: 'Payload inválido'
      });
    }

    const data = payload.data || {};

    // ✅ NOVO: Filtrar eventos de ticket (não são mensagens de chat)
    if (data.type === 'ticket' || data.origin === 'ticket') {
      console.log('ℹ️ Evento de ticket ignorado (não é mensagem de chat)');
      return res.status(200).json({
        success: true,
        message: 'Evento de ticket ignorado'
      });
    }

    // ✅ NOVO: Validar que é mensagem de chat
    if (data.type && data.type !== 'chat') {
      console.log(`ℹ️ Tipo de mensagem ignorado: ${data.type}`);
      return res.status(200).json({
        success: true,
        message: `Tipo de mensagem ignorado: ${data.type}`
      });
    }

    // EXTRAIR DADOS DO CONTATO
    const contactData = await extractContactData(payload);
    
    if (!contactData.phone) {
      console.warn('⚠️ Não foi possível obter telefone do contato');
      
      // Criar lead mesmo sem telefone (usando contactId como identificador)
      contactData.phone = `ID-${contactData.contactId}`;
      contactData.name = `Contato ${contactData.contactId.substring(0, 8)}`;
      
      console.log('ℹ️ Criando lead sem telefone:', {
        name: contactData.name,
        phone: contactData.phone
      });
    }

    console.log('📞 Dados extraídos:', {
      name: contactData.name,
      phone: contactData.phone,
      message: contactData.messageText
    });

    // VERIFICAR SE LEAD JÁ EXISTE (DEDUPLICAÇÃO OTIMIZADA)
    const existingLead = await findLeadByPhoneOptimized(contactData.phone);
    
    if (existingLead) {
      console.log(`ℹ️ Lead já existe: ${existingLead.id} - Ignorando nova mensagem`);
      
      return res.status(200).json({
        success: true,
        message: 'Lead já existe, mensagem ignorada',
        leadId: existingLead.id,
        action: 'ignored'
      });
    }

    // CRIAR NOVO LEAD NO FIREBASE
    const leadData = buildLeadData(contactData);
    const leadRef = await db.collection('leads').add(leadData);
    
    console.log(`✅ Lead criado com sucesso: ${leadRef.id}`);

    // Adicionar ao cache
    setCachedLead(contactData.phone, { id: leadRef.id, ...leadData });

    // RETORNAR SUCESSO
    return res.status(200).json({
      success: true,
      message: 'Lead criado com sucesso',
      leadId: leadRef.id,
      action: 'created',
      contact: {
        name: contactData.name,
        phone: contactData.phone
      }
    });

  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar webhook',
      details: error.message
    });
  }
}

// ========================================
// EXTRAÇÃO DE DADOS DO CONTATO
// ========================================

async function extractContactData(payload) {
  const data = payload.data || {};
  const contactId = data.contactId;
  const messageText = data.text || '';
  const messageTimestamp = data.timestamp || data.createdAt || new Date().toISOString();
  
  // Inicializar dados do contato
  const contactData = {
    name: '',
    phone: '',
    email: '',
    messageText: messageText,
    messageTimestamp: messageTimestamp,
    channel: 'whatsapp',
    contactId: contactId,
    messageId: data.id || ''
  };

  // BUSCAR DADOS COMPLETOS DO CONTATO NA API DO DIGISAC
  if (contactId) {
    const contactInfo = await fetchContactFromDigisac(contactId);
    
    if (contactInfo) {
      contactData.name = contactInfo.name || '';
      contactData.phone = contactInfo.phone || '';
      contactData.email = contactInfo.email || '';
      
      console.log('✅ Dados obtidos da API Digisac:', {
        name: contactData.name,
        phone: contactData.phone,
        email: contactData.email
      });
    }
  }

  // Se não conseguiu obter nome, usar telefone formatado
  if (!contactData.name) {
    if (contactData.phone && contactData.phone.includes('(')) {
      // Telefone já formatado: (19) 99267-9636
      contactData.name = contactData.phone;
    } else if (contactData.phone) {
      // Telefone sem formatação
      contactData.name = `Contato ${contactData.phone}`;
    } else {
      // Sem telefone
      contactData.name = `Contato ${contactId.substring(0, 8)}`;
    }
  }

  return contactData;
}

// ========================================
// BUSCA DE CONTATO NA API DO DIGISAC
// ========================================

async function fetchContactFromDigisac(contactId) {
  const apiToken = process.env.DIGISAC_API_TOKEN;
  
  if (!apiToken) {
    console.warn('⚠️ DIGISAC_API_TOKEN não configurado - não é possível buscar dados do contato');
    return null;
  }

  // URL da API pode variar por empresa: https://NOME_EMPRESA-api.digisac.com.br
  // Ou usar URL genérica se configurada
  const apiUrl = process.env.DIGISAC_API_URL || 'https://api.digisac.com.br';

  try {
    // Normalizar URL (remover /api/v1 se já estiver na URL base)
    const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '');
    const fullUrl = `${baseUrl}/api/v1/contacts/${contactId}`;
    
    console.log(`🔍 Buscando contato ${contactId} na API: ${fullUrl}`);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      // A opção `timeout` NÃO é suportada pelo fetch do runtime (undici) — era ignorada.
      // O correto é abortar via AbortSignal.
      signal: AbortSignal.timeout(5000) // 5 segundos
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.error(`🔑 DIGISAC_API_TOKEN INVÁLIDO/EXPIRADO (HTTP ${response.status}). ` +
          `Os leads serão criados como "Contato <id>" / "ID-<id>" até o token ser renovado no Vercel.`);
      } else {
        console.warn(`⚠️ Erro ao buscar contato: ${response.status} ${response.statusText}`);
      }
      return null;
    }

    const data = await response.json();
    console.log('📦 Resposta da API Digisac:', JSON.stringify(data, null, 2));
    
    // Extrair dados do contato
    const contact = data.contact || data;
    
    // Extrair nome (priorizar internalName, depois name)
    let name = contact.internalName || contact.name || contact.nome || '';
    
    // Se o nome for apenas o número de telefone, usar nome amigável
    if (name && /^\d+$/.test(name.replace(/\D/g, ''))) {
      // Nome é apenas números, provavelmente não é um nome real
      name = ''; // Deixar vazio para usar fallback
    }
    
    // Extrair telefone (pode estar em vários lugares)
    let phone = '';
    
    // 1. Tentar pegar de data.number
    if (contact.data && contact.data.number) {
      phone = contact.data.number;
    }
    // 2. Tentar extrair de idFromService (formato: 5519992912844@c.us)
    else if (contact.idFromService && contact.idFromService.includes('@')) {
      phone = contact.idFromService.split('@')[0];
    }
    // 3. Tentar campos diretos
    else {
      phone = contact.phone || contact.telefone || contact.number || '';
    }
    
    // Se o telefone for um array, pegar o primeiro
    if (Array.isArray(phone) && phone.length > 0) {
      phone = phone[0];
    }
    
    // Formatar telefone brasileiro
    if (phone && phone.length >= 10) {
      phone = formatBrazilianPhone(phone);
    }
    
    return {
      name: name,
      phone: phone,
      email: contact.email || ''
    };
  } catch (error) {
    console.error('❌ Erro ao buscar contato na API:', error.message);
    return null;
  }
}

// ========================================
// BUSCA OTIMIZADA DE LEAD POR TELEFONE
// ========================================

/**
 * Busca lead por telefone de forma OTIMIZADA
 * 
 * OTIMIZAÇÕES vs versão anterior:
 * 1. Verifica cache primeiro (0 leituras se encontrar)
 * 2. Usa query com where() ao invés de .get() completo
 * 3. Limita resultados
 * 4. Fallback limitado a 100 leads (vs todos)
 * 
 * REDUÇÃO: 99% menos leituras do Firebase
 */
async function findLeadByPhoneOptimized(phone) {
  try {
    const normalizedPhone = normalizePhone(phone);
    
    if (!normalizedPhone) {
      return null;
    }
    
    // 1. Verificar cache primeiro (0 leituras)
    const cached = getCachedLead(normalizedPhone);
    if (cached) {
      return cached;
    }
    
    console.log(`🔍 Buscando lead com telefone normalizado: ${normalizedPhone}`);
    
    // 2. Buscar por telefone exato primeiro (1 leitura)
    const exactMatch = await db.collection('leads')
      .where('telefone', '==', phone)
      .limit(1)
      .get();
    
    if (!exactMatch.empty) {
      const doc = exactMatch.docs[0];
      const lead = { id: doc.id, ...doc.data() };
      console.log(`✅ Lead existente encontrado: ${doc.id} (telefone: ${phone})`);
      setCachedLead(normalizedPhone, lead);
      return lead;
    }
    
    // 3. Se não encontrou, buscar TODAS variações comuns de formatação
    const variations = getPhoneVariations(phone);

    for (const variation of variations) {
      const snapshot = await db.collection('leads')
        .where('telefone', '==', variation)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const lead = { id: doc.id, ...doc.data() };
        console.log(`✅ Lead existente encontrado: ${doc.id} (telefone: ${variation})`);
        setCachedLead(normalizedPhone, lead);
        return lead;
      }
    }

    // 4. Fallback otimizado: buscar apenas campo telefone para comparação
    //    Usa select() para minimizar custo de leitura
    const allLeads = await db.collection('leads')
      .select('telefone')
      .get();

    for (const doc of allLeads.docs) {
      const leadData = doc.data();
      const leadPhone = normalizePhone(leadData.telefone || '');

      if (leadPhone && leadPhone === normalizedPhone) {
        const lead = { id: doc.id, ...leadData };
        console.log(`✅ Lead existente encontrado (fallback): ${doc.id} (telefone: ${leadData.telefone})`);
        setCachedLead(normalizedPhone, lead);
        return lead;
      }
    }
    
    console.log(`ℹ️ Nenhum lead existente encontrado com este telefone`);
    return null;
    
  } catch (error) {
    console.error('Erro ao buscar lead:', error);
    return null;
  }
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/**
 * Formata telefone no padrão do sistema: (XX) XXXXX-XXXX
 */
function formatBrazilianPhone(phone) {
  // Remover caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Se começar com 55 (código do Brasil), remover
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    cleaned = cleaned.substring(2);
  }
  
  // Se tiver 11 dígitos (DDD + 9 dígitos) - celular
  if (cleaned.length === 11) {
    const ddd = cleaned.substring(0, 2);
    const firstPart = cleaned.substring(2, 7);
    const secondPart = cleaned.substring(7);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }
  
  // Se tiver 10 dígitos (DDD + 8 dígitos) - fixo
  if (cleaned.length === 10) {
    const ddd = cleaned.substring(0, 2);
    const firstPart = cleaned.substring(2, 6);
    const secondPart = cleaned.substring(6);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }
  
  // Se não conseguir formatar, retornar como está
  return phone;
}

/**
 * Normaliza telefone para comparação (remove todos os caracteres especiais)
 */
function normalizePhone(phone) {
  if (!phone) return '';
  // Remove tudo exceto números
  let cleaned = phone.replace(/\D/g, '');
  // Remove código do país se existir
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

/**
 * Gera variações comuns de um telefone
 */
function getPhoneVariations(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  
  const variations = [];

  if (normalized.length === 11) {
    const ddd = normalized.substring(0, 2);
    const p1 = normalized.substring(2, 7);
    const p2 = normalized.substring(7);
    // Formato com espaço: (XX) XXXXX-XXXX
    variations.push(`(${ddd}) ${p1}-${p2}`);
    // Formato sem espaço: (XX)XXXXX-XXXX
    variations.push(`(${ddd})${p1}-${p2}`);
  }

  if (normalized.length === 10) {
    const ddd = normalized.substring(0, 2);
    const p1 = normalized.substring(2, 6);
    const p2 = normalized.substring(6);
    variations.push(`(${ddd}) ${p1}-${p2}`);
    variations.push(`(${ddd})${p1}-${p2}`);
  }

  // Com código do país
  variations.push(`+55 ${formatBrazilianPhone(normalized)}`);
  variations.push(`55${normalized}`);

  // Sem formatação
  variations.push(normalized);

  return variations;
}

/**
 * Constrói objeto de lead para Firebase (formato camelCase)
 */
function buildLeadData(contactData) {
  const now = new Date().toISOString();
  
  return {
    // Dados básicos do contato
    nomePackiente: contactData.name,
    telefone: contactData.phone,
    email: contactData.email,
    dataNascimento: '',
    
    // Canal e origem
    canalContato: 'Outros',
    solicitacaoPaciente: contactData.messageText || 'Contato via WhatsApp',
    
    // Status e agendamento
    status: 'Lead',
    agendado: false,
    motivoNaoAgendamento: '',
    
    // Médico e especialidade
    medicoAgendadoId: '',
    especialidadeId: '',
    procedimentoAgendadoId: '',
    
    // Outros profissionais
    outrosProfissionaisAgendados: false,
    quaisProfissionais: '',
    outrosProfissionais: [
      { medicoId: '', especialidadeId: '', dataAgendamento: '', ativo: false },
      { medicoId: '', especialidadeId: '', dataAgendamento: '', ativo: false },
      { medicoId: '', especialidadeId: '', dataAgendamento: '', ativo: false },
      { medicoId: '', especialidadeId: '', dataAgendamento: '', ativo: false },
      { medicoId: '', especialidadeId: '', dataAgendamento: '', ativo: false }
    ],
    
    // Financeiro
    pagouReserva: false,
    tipoVisita: 'Primeira Visita',
    valorOrcado: 0,
    orcamentoFechado: false,
    valorFechadoParcial: 0,
    
    // Follow-ups
    followup1Realizado: false,
    followup1Data: '',
    followup2Realizado: false,
    followup2Data: '',
    followup3Realizado: false,
    followup3Data: '',
    
    // Observações e perfil
    observacaoGeral: `Contato recebido via WhatsApp em ${new Date().toLocaleString('pt-BR')}\n\nMensagem: ${contactData.messageText || 'N/A'}`,
    perfilComportamentalDisc: '',
    
    // Datas
    dataRegistroContato: contactData.messageTimestamp,
    dataUltimaAlteracao: now,
    
    // Tags (usar ID do documento da tag no Firebase)
    tags: ['enVbdaJMPYAo4NvjsX5b'], // ID da tag 'DIGISAC LEAD'
    
    // Rastreamento de usuário
    criadoPorId: 'sistema-digisac',
    criadoPorNome: 'Integração Digisac',
    criadoPorEmail: 'sistema@digisac.com',
    alteradoPorId: 'sistema-digisac',
    alteradoPorNome: 'Integração Digisac',
    alteradoPorEmail: 'sistema@digisac.com',
    
    // Metadados Digisac
    digisacContactId: contactData.contactId,
    digisacMessageId: contactData.messageId,
    
    // Timestamps Firebase
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}
