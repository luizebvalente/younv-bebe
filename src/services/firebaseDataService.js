// Serviço de dados híbrido Firebase/localStorage - VERSÃO CORRIGIDA COM VALOR_AGENDAMENTO
import firestoreService from './firebase/firestore'

// Logger condicional — apenas em DEV. Em produção evita custo de serializar payloads grandes.
const DEV = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
const log = (...args) => { if (DEV) console.log(...args) }

// Cache simples de leituras por entidade: evita que Header, Sidebar e a página
// baixem a MESMA coleção inteira em paralelo no boot, e que cada ação recarregue
// coleções que não mudaram. Escritas invalidam a entidade correspondente.
const CACHE_TTL_MS = 60 * 1000

class FirebaseDataService {
  constructor() {
    this.useFirebase = true // Ativar Firebase
    this._cache = new Map()    // entity -> { data, ts }
    this._inflight = new Map() // entity -> Promise
    // NOTA: initializeData() não roda mais no boot — fazia um getAll('especialidades')
    // (e possíveis escritas) a cada carregamento da página, antes mesmo do login.
    // A base de produção já está inicializada; para seed manual use initializeData().
  }

  invalidateCache(entity) {
    if (entity) {
      this._cache.delete(entity)
      this._inflight.delete(entity)
    } else {
      this._cache.clear()
      this._inflight.clear()
    }
  }

  // Função para obter dados do usuário atual
  getCurrentUserInfo() {
    if (typeof window !== 'undefined' && window.currentUser) {
      return {
        id: window.currentUser.uid || window.currentUser.id,
        nome: window.currentUser.displayName || window.currentUser.nome || 'Usuário',
        email: window.currentUser.email || ''
      }
    }

    return {
      id: 'sistema',
      nome: 'Sistema',
      email: 'sistema@younv.com'
    }
  }

  // Mapeamento de nomes de coleções
  getCollectionName(entity) {
    const mapping = {
      'especialidades': 'especialidades',
      'medicos': 'medicos',
      'procedimentos': 'procedimentos',
      'leads': 'leads',
      'tags': 'tags',
      'lembretes': 'lembretes',
      'carteiras_gestao': 'carteiras_gestao',
      'pos_consulta': 'pos_consulta'
    }
    return mapping[entity] || entity
  }

  // Converte uma chave snake_case para o camelCase usado nos documentos do Firestore
  snakeToCamelKey(key) {
    return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
  }

  // Transforma APENAS os campos presentes em `data` para o formato Firebase.
  // Essencial em updates parciais: transformToFirebase monta o documento completo
  // preenchendo campos ausentes com defaults ('' / 0 / [] / false), o que fazia um
  // update parcial (ex: registrar passagem, atualizar performance de carteira)
  // apagar nome, telefone, histórico e demais dados do documento no Firestore.
  transformPartialToFirebase(entity, data) {
    const full = this.transformToFirebase(entity, data)
    // Entidade sem transform específico: transformToFirebase retorna o próprio objeto
    if (full === data) return data

    const partial = {}
    Object.keys(data).forEach(key => {
      let camelKey = this.snakeToCamelKey(key)
      // Exceção histórica: o campo no Firestore chama-se "nomePackiente" (typo antigo)
      if (entity === 'leads' && key === 'nome_paciente') camelKey = 'nomePackiente'
      if (Object.prototype.hasOwnProperty.call(full, camelKey)) {
        partial[camelKey] = full[camelKey]
      }
    })
    return partial
  }

  // Transformar dados para formato Firebase (camelCase)
  transformToFirebase(entity, data) {
    if (entity === 'leads') {
      return {
        nomePackiente: data.nome_paciente || '',
        telefone: data.telefone || '',
        dataNascimento: data.data_nascimento || '',
        email: data.email || '',
        canalContato: data.canal_contato || '',
        solicitacaoPaciente: data.solicitacao_paciente || '',
        medicoAgendadoId: data.medico_agendado_id || '',
        especialidadeId: data.especialidade_id || '',
        procedimentoAgendadoId: data.procedimento_agendado_id || '',
        agendado: data.agendado || false,
        motivoNaoAgendamento: data.motivo_nao_agendamento || '',
        outrosProfissionaisAgendados: data.outros_profissionais_agendados || false,
        quaisProfissionais: data.quais_profissionais || '',

        // ✅ CORRIGIDO: Array de outros profissionais com valorAgendamento
        outrosProfissionais: data.outros_profissionais || [
          { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false },
          { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false },
          { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false },
          { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false },
          { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false }
        ].map(prof => ({
          medicoId: prof.medico_id || prof.medicoId || '',
          especialidadeId: prof.especialidade_id || prof.especialidadeId || '',
          procedimentoId: prof.procedimento_id || prof.procedimentoId || '',
          dataAgendamento: prof.data_agendamento || prof.dataAgendamento || '',
          valorAgendamento: prof.valor_agendamento || prof.valorAgendamento || '', // ✅ CORRIGIDO
          localAgendado: prof.local_agendado || prof.localAgendado || '',
          ativo: prof.ativo || false
        })),

        pagouReserva: data.pagou_reserva || false,
        tipoVisita: data.tipo_visita || '',
        valorOrcado: data.valor_orcado || '',
        orcamentoFechado: data.orcamento_fechado || '',
        valorConsulta: data.valor_consulta || '',
        valorTaxaReserva: data.valor_taxa_reserva || '',
        valorProcedimento: data.valor_procedimento || '',
        identificacaoProcedimento: data.identificacao_procedimento || '',
        dataConsultaEfetiva: data.data_consulta_efetiva || '',
        valorFechadoParcial: data.valor_fechado_parcial || 0,
        followup1Realizado: data.followup1_realizado || false,
        followup1Data: data.followup1_data || '',
        followup2Realizado: data.followup2_realizado || false,
        followup2Data: data.followup2_data || '',
        followup3Realizado: data.followup3_realizado || false,
        followup3Data: data.followup3_data || '',
        nomePai: data.nome_pai || '',
        nomeMae: data.nome_mae || '',
        observacaoGeral: data.observacao_geral || '',
        perfilComportamentalDisc: data.perfil_comportamental_disc || '',
        status: data.status || 'Sem Interação',
        dataRegistroContato: data.data_registro_contato || new Date().toISOString(),
        tags: data.tags || [],
        // CAMPOS DE RASTREAMENTO DE USUÁRIO
        criadoPorId: data.criado_por_id || '',
        criadoPorNome: data.criado_por_nome || '',
        criadoPorEmail: data.criado_por_email || '',
        alteradoPorId: data.alterado_por_id || '',
        alteradoPorNome: data.alterado_por_nome || '',
        alteradoPorEmail: data.alterado_por_email || '',
        dataUltimaAlteracao: data.data_ultima_alteracao || new Date().toISOString(),
        // CAMPOS DE HISTORICO DE CONSUMO
        historicoConsumo: (data.historico_consumo || []).map(consumo => ({
          data: consumo.data || '',
          produtoId: consumo.produto_id || '',
          produtoNome: consumo.produto_nome || '',
          loteNumero: consumo.lote_numero || '',
          quantidade: consumo.quantidade || 0,
          valorUnitario: consumo.valor_unitario || 0,
          valorTotal: consumo.valor_total || 0,
          estoqueNome: consumo.estoque_nome || '',
          usuarioNome: consumo.usuario_nome || '',
          observacao: consumo.observacao || ''
        })),
        totalConsumos: data.total_consumos || 0,
        totalGastoProdutos: data.total_gasto_produtos || 0,
        ticketMedioProdutos: data.ticket_medio_produtos || 0,
        ultimaCompraData: data.ultima_compra_data || '',
        // CAMPOS DE HISTORICO DE VISITAS (RECORRÊNCIA)
        historicoVisitas: (data.historico_visitas || []).map(visita => ({
          id: visita.id || '',
          dataVisita: visita.data_visita || '',
          medicoId: visita.medico_id || '',
          medicoNome: visita.medico_nome || '',
          especialidadeId: visita.especialidade_id || '',
          especialidadeNome: visita.especialidade_nome || '',
          procedimentoId: visita.procedimento_id || '',
          procedimentoNome: visita.procedimento_nome || '',
          tipoVisita: visita.tipo_visita || '',
          valor: visita.valor || 0,
          local: visita.local || '',
          observacoes: visita.observacoes || '',
          status: visita.status || '',
          registradoPorId: visita.registrado_por_id || '',
          registradoPorNome: visita.registrado_por_nome || '',
          dataRegistro: visita.data_registro || '',
          dataUltimaAlteracao: visita.data_ultima_alteracao || '',
          tags: visita.tags || []
        })),
        totalVisitas: data.total_visitas || 0,
        primeiraVisita: data.primeira_visita || '',
        ultimaVisita: data.ultima_visita || '',
        valorTotalVisitas: data.valor_total_visitas || 0,
        mediaDiasEntreVisitas: data.media_dias_entre_visitas || 0,
        // CAMPO CONSOLIDADO: Total gasto pelo paciente (visitas + produtos)
        valorTotalGasto: data.valor_total_gasto || 0,
        // CAMPO DE VISITAS POR ESPECIALIDADE (multiespecialidade)
        visitasPorEspecialidade: data.visitas_por_especialidade || {}
      }
    }
    if (entity === 'tags') {
      return {
        nome: data.nome,
        cor: data.cor,
        categoria: data.categoria,
        dataCriacao: data.data_criacao || new Date().toISOString(),
        ativo: data.ativo !== undefined ? data.ativo : true
      }
    }
    if (entity === 'lembretes') {
      return {
        leadId: data.lead_id,
        dataLembrete: data.data_lembrete,
        descricao: data.descricao,
        observacoes: data.observacoes || '',
        status: data.status || 'Pendente',
        dataConclusao: data.data_conclusao || null,
        criadoPorId: data.criado_por_id,
        criadoPorNome: data.criado_por_nome,
        criadoPorEmail: data.criado_por_email,
        dataCriacao: data.data_criacao || new Date().toISOString(),
        alteradoPorId: data.alterado_por_id,
        alteradoPorNome: data.alterado_por_nome,
        alteradoPorEmail: data.alterado_por_email,
        dataUltimaAlteracao: data.data_ultima_alteracao
      }
    }
    if (entity === 'carteiras_gestao') {
      const perf = data.performance || { totalReativados: 0, receitaGerada: 0, dataUltimaAtualizacao: '' }
      return {
        nomeCarteira: data.nome_carteira || '',
        dataCriacao: data.data_criacao || new Date().toISOString(),
        criadoPorId: data.criado_por_id || '',
        criadoPorNome: data.criado_por_nome || '',
        listaPacientes: data.lista_pacientes || [],
        totalPacientes: data.total_pacientes || 0,
        filtrosAplicados: data.filtros_aplicados || {},
        status: data.status || 'ativa',
        performance: {
          totalReativados: perf.totalReativados || 0,
          receitaGerada: perf.receitaGerada || 0,
          dataUltimaAtualizacao: perf.dataUltimaAtualizacao || ''
        }
      }
    }
    if (entity === 'pos_consulta') {
      return {
        leadId: data.lead_id,
        nomePaciente: data.nome_paciente,
        dataConsulta: data.data_consulta,
        resumoAtendimento: data.resumo_atendimento || '',
        orientacoesPaciente: data.orientacoes_paciente || '',
        proximoRetorno: data.proximo_retorno || '',
        observacoesInternas: data.observacoes_internas || '',
        criadoPorId: data.criado_por_id,
        criadoPorNome: data.criado_por_nome,
        dataCriacao: data.data_criacao || new Date().toISOString()
      }
    }
    return data
  }

  // Transformar dados do Firebase para formato frontend (snake_case)
  transformFromFirebase(entity, data) {
    if (entity === 'leads') {
      return {
        id: data.id,
        nome_paciente: data.nomePackiente || data.nome_paciente,
        telefone: data.telefone,
        data_nascimento: data.dataNascimento || data.data_nascimento,
        email: data.email,
        canal_contato: data.canalContato || data.canal_contato,
        solicitacao_paciente: data.solicitacaoPaciente || data.solicitacao_paciente,
        medico_agendado_id: data.medicoAgendadoId || data.medico_agendado_id,
        especialidade_id: data.especialidadeId || data.especialidade_id,
        procedimento_agendado_id: data.procedimentoAgendadoId || data.procedimento_agendado_id,
        agendado: data.agendado,
        motivo_nao_agendamento: data.motivoNaoAgendamento || data.motivo_nao_agendamento,
        outros_profissionais_agendados: data.outrosProfissionaisAgendados || data.outros_profissionais_agendados,
        quais_profissionais: data.quaisProfissionais || data.quais_profissionais,

        // ✅ CORRIGIDO: Transformar array de outros profissionais COM valor_agendamento
        outros_profissionais: data.outrosProfissionais ? data.outrosProfissionais.map(prof => ({
          medico_id: prof.medicoId || prof.medico_id || '',
          especialidade_id: prof.especialidadeId || prof.especialidade_id || '',
          procedimento_id: prof.procedimentoId || prof.procedimento_id || '',
          data_agendamento: prof.dataAgendamento || prof.data_agendamento || '',
          valor_agendamento: prof.valorAgendamento || prof.valor_agendamento || '', // ✅ CORRIGIDO
          local_agendado: prof.localAgendado || prof.local_agendado || '',
          ativo: prof.ativo || false
        })) : [
          { medico_id: '', especialidade_id: '', procedimento_id: '', data_agendamento: '', valor_agendamento: '', local_agendado: '', ativo: false },
          { medico_id: '', especialidade_id: '', procedimento_id: '', data_agendamento: '', valor_agendamento: '', local_agendado: '', ativo: false },
          { medico_id: '', especialidade_id: '', procedimento_id: '', data_agendamento: '', valor_agendamento: '', local_agendado: '', ativo: false },
          { medico_id: '', especialidade_id: '', procedimento_id: '', data_agendamento: '', valor_agendamento: '', local_agendado: '', ativo: false },
          { medico_id: '', especialidade_id: '', procedimento_id: '', data_agendamento: '', valor_agendamento: '', local_agendado: '', ativo: false }
        ],

        pagou_reserva: data.pagouReserva || data.pagou_reserva,
        tipo_visita: data.tipoVisita || data.tipo_visita,
        valor_orcado: data.valorOrcado || data.valor_orcado,
        orcamento_fechado: data.orcamentoFechado || data.orcamento_fechado,
        valor_consulta: data.valorConsulta || data.valor_consulta || '',
        valor_taxa_reserva: data.valorTaxaReserva || data.valor_taxa_reserva || '',
        valor_procedimento: data.valorProcedimento || data.valor_procedimento || '',
        identificacao_procedimento: data.identificacaoProcedimento || data.identificacao_procedimento || '',
        data_consulta_efetiva: data.dataConsultaEfetiva || data.data_consulta_efetiva || '',
        valor_fechado_parcial: data.valorFechadoParcial || data.valor_fechado_parcial || 0,
        followup1_realizado: data.followup1Realizado || data.followup1_realizado || false,
        followup1_data: data.followup1Data || data.followup1_data || '',
        followup2_realizado: data.followup2Realizado || data.followup2_realizado || false,
        followup2_data: data.followup2Data || data.followup2_data || '',
        followup3_realizado: data.followup3Realizado || data.followup3_realizado || false,
        followup3_data: data.followup3Data || data.followup3_data || '',
        nome_pai: data.nomePai || data.nome_pai || '',
        nome_mae: data.nomeMae || data.nome_mae || '',
        observacao_geral: data.observacaoGeral || data.observacao_geral,
        perfil_comportamental_disc: data.perfilComportamentalDisc || data.perfil_comportamental_disc,
        status: data.status,
        data_registro_contato: data.dataRegistroContato || data.data_registro_contato,
        tags: data.tags || [],
        // CAMPOS DE RASTREAMENTO DE USUÁRIO
        criado_por_id: data.criadoPorId || data.criado_por_id,
        criado_por_nome: data.criadoPorNome || data.criado_por_nome || 'Sistema',
        criado_por_email: data.criadoPorEmail || data.criado_por_email || '',
        alterado_por_id: data.alteradoPorId || data.alterado_por_id,
        alterado_por_nome: data.alteradoPorNome || data.alterado_por_nome || 'Sistema',
        alterado_por_email: data.alteradoPorEmail || data.alterado_por_email || '',
        data_ultima_alteracao: data.dataUltimaAlteracao || data.data_ultima_alteracao,
        // CAMPOS DE HISTORICO DE CONSUMO
        historico_consumo: (data.historicoConsumo || []).map(consumo => ({
          data: consumo.data,
          produto_id: consumo.produtoId,
          produto_nome: consumo.produtoNome,
          lote_numero: consumo.loteNumero,
          quantidade: consumo.quantidade,
          valor_unitario: consumo.valorUnitario,
          valor_total: consumo.valorTotal,
          estoque_nome: consumo.estoqueNome,
          usuario_nome: consumo.usuarioNome,
          observacao: consumo.observacao || ''
        })),
        total_consumos: data.totalConsumos || 0,
        total_gasto_produtos: data.totalGastoProdutos || 0,
        ticket_medio_produtos: data.ticketMedioProdutos || 0,
        ultima_compra_data: data.ultimaCompraData || '',
        // CAMPOS DE HISTORICO DE VISITAS (RECORRÊNCIA)
        historico_visitas: (data.historicoVisitas || []).map(visita => ({
          id: visita.id,
          data_visita: visita.dataVisita,
          medico_id: visita.medicoId,
          medico_nome: visita.medicoNome,
          especialidade_id: visita.especialidadeId,
          especialidade_nome: visita.especialidadeNome,
          procedimento_id: visita.procedimentoId,
          procedimento_nome: visita.procedimentoNome,
          tipo_visita: visita.tipoVisita,
          valor: visita.valor,
          local: visita.local,
          observacoes: visita.observacoes,
          status: visita.status,
          registrado_por_id: visita.registradoPorId,
          registrado_por_nome: visita.registradoPorNome,
          data_registro: visita.dataRegistro,
          data_ultima_alteracao: visita.dataUltimaAlteracao,
          tags: visita.tags || []
        })),
        total_visitas: data.totalVisitas || 0,
        primeira_visita: data.primeiraVisita || '',
        ultima_visita: data.ultimaVisita || '',
        valor_total_visitas: data.valorTotalVisitas || 0,
        media_dias_entre_visitas: data.mediaDiasEntreVisitas || 0,
        // CAMPO CONSOLIDADO: Total gasto pelo paciente (visitas + produtos)
        valor_total_gasto: data.valorTotalGasto || 0,
        // CAMPO DE VISITAS POR ESPECIALIDADE (multiespecialidade)
        visitas_por_especialidade: data.visitasPorEspecialidade || data.visitas_por_especialidade || {},
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      }
    }
    if (entity === 'tags') {
      return {
        id: data.id,
        nome: data.nome,
        cor: data.cor,
        categoria: data.categoria,
        data_criacao: data.dataCriacao || data.data_criacao,
        ativo: data.ativo !== undefined ? data.ativo : true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      }
    }
    if (entity === 'lembretes') {
      return {
        id: data.id,
        lead_id: data.leadId || data.lead_id,
        data_lembrete: data.dataLembrete || data.data_lembrete,
        descricao: data.descricao,
        observacoes: data.observacoes || '',
        status: data.status || 'Pendente',
        data_conclusao: data.dataConclusao || data.data_conclusao,
        criado_por_id: data.criadoPorId || data.criado_por_id,
        criado_por_nome: data.criadoPorNome || data.criado_por_nome,
        criado_por_email: data.criadoPorEmail || data.criado_por_email,
        data_criacao: data.dataCriacao || data.data_criacao,
        alterado_por_id: data.alteradoPorId || data.alterado_por_id,
        alterado_por_nome: data.alteradoPorNome || data.alterado_por_nome,
        alterado_por_email: data.alteradoPorEmail || data.alterado_por_email,
        data_ultima_alteracao: data.dataUltimaAlteracao || data.data_ultima_alteracao,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      }
    }
    if (entity === 'carteiras_gestao') {
      return {
        id: data.id,
        nome_carteira: data.nomeCarteira || data.nome_carteira,
        data_criacao: data.dataCriacao || data.data_criacao,
        criado_por_id: data.criadoPorId || data.criado_por_id,
        criado_por_nome: data.criadoPorNome || data.criado_por_nome,
        lista_pacientes: data.listaPacientes || data.lista_pacientes || [],
        total_pacientes: data.totalPacientes || data.total_pacientes || 0,
        filtros_aplicados: data.filtrosAplicados || data.filtros_aplicados || {},
        status: data.status || 'ativa',
        performance: data.performance || {
          totalReativados: 0,
          receitaGerada: 0,
          dataUltimaAtualizacao: null
        },
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      }
    }
    if (entity === 'pos_consulta') {
      return {
        id: data.id,
        lead_id: data.leadId || data.lead_id,
        nome_paciente: data.nomePaciente || data.nome_paciente,
        data_consulta: data.dataConsulta || data.data_consulta,
        resumo_atendimento: data.resumoAtendimento || data.resumo_atendimento || '',
        orientacoes_paciente: data.orientacoesPaciente || data.orientacoes_paciente || '',
        proximo_retorno: data.proximoRetorno || data.proximo_retorno || '',
        observacoes_internas: data.observacoesInternas || data.observacoes_internas || '',
        criado_por_id: data.criadoPorId || data.criado_por_id,
        criado_por_nome: data.criadoPorNome || data.criado_por_nome,
        data_criacao: data.dataCriacao || data.data_criacao,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      }
    }
    return data
  }

  // ==========================================
  // MIGRAÇÃO: Adicionar novos campos aos outros profissionais
  // ==========================================
  async migrateOutrosProfissionaisFields() {
    if (!this.useFirebase) {
      console.log('Migração só funciona com Firebase ativo')
      return { success: false, message: 'Firebase não está ativo' }
    }

    try {
      console.log('🔄 Iniciando migração de campos de outros profissionais...')

      const rawLeads = await firestoreService.getAll('leads')
      console.log(`📊 Encontrados ${rawLeads.length} leads para análise`)

      let migrated = 0
      let total = rawLeads.length
      const errors = []

      for (const lead of rawLeads) {
        try {
          // Verificar se precisa migrar
          const needsMigration = !lead.outrosProfissionais ||
            !Array.isArray(lead.outrosProfissionais) ||
            lead.outrosProfissionais.length !== 5 ||
            lead.outrosProfissionais.some(prof =>
              !prof.hasOwnProperty('procedimentoId') ||
              !prof.hasOwnProperty('valorAgendamento') || // ✅ CORRIGIDO
              !prof.hasOwnProperty('localAgendado')
            )

          if (needsMigration) {
            const updatedLead = {
              ...lead,
              // ✅ CORRIGIDO: Estrutura nova completa com valorAgendamento
              outrosProfissionais: [
                { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false },
                { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false },
                { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false },
                { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false },
                { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false }
              ].map((slot, index) => {
                // Preservar dados antigos se existirem
                const oldData = lead.outrosProfissionais?.[index] || {}
                return {
                  medicoId: oldData.medicoId || '',
                  especialidadeId: oldData.especialidadeId || '',
                  procedimentoId: oldData.procedimentoId || '',
                  dataAgendamento: oldData.dataAgendamento || '',
                  valorAgendamento: oldData.valorAgendamento || oldData.valor || '', // ✅ CORRIGIDO - aceita ambos
                  localAgendado: oldData.localAgendado || '',
                  ativo: oldData.ativo || false
                }
              })
            }

            await firestoreService.update('leads', lead.id, updatedLead)
            migrated++
            console.log(`✅ Lead ${lead.nomePackiente || lead.nome_paciente} migrado com novos campos`)
          }
        } catch (leadError) {
          console.error(`❌ Erro ao migrar lead ${lead.id}:`, leadError)
          errors.push({
            leadId: lead.id,
            error: leadError.message
          })
        }
      }

      console.log(`🎉 Migração de campos de outros profissionais concluída!`)
      console.log(`📈 Estatísticas: ${migrated} de ${total} leads migrados`)

      return {
        success: true,
        message: `Migração concluída! ${migrated} de ${total} leads atualizados com novos campos (procedimento, valor, local).`,
        stats: { total, migrated, errors: errors.length }
      }
    } catch (error) {
      console.error('❌ Erro na migração de campos de outros profissionais:', error)
      return {
        success: false,
        message: `Erro na migração: ${error.message}`,
        stats: { total: 0, migrated: 0, errors: 1 }
      }
    }
  }

  // ==========================================
  // FUNÇÕES PARA TAGS
  // ==========================================

  async migrateLeadsForUserTracking() {
    if (!this.useFirebase) {
      console.log('Migração só funciona com Firebase ativo')
      return { success: false, message: 'Firebase não está ativo' }
    }

    try {
      console.log('🔄 Iniciando migração de rastreamento de usuário...')

      const rawLeads = await firestoreService.getAll('leads')
      console.log(`📊 Encontrados ${rawLeads.length} leads para análise`)

      let migrated = 0
      let total = rawLeads.length
      const errors = []
      const currentUser = this.getCurrentUserInfo()

      for (const lead of rawLeads) {
        try {
          const needsUserTracking = !lead.hasOwnProperty('criadoPorId') ||
            !lead.hasOwnProperty('criadoPorNome') ||
            !lead.hasOwnProperty('alteradoPorId') ||
            !lead.hasOwnProperty('alteradoPorNome')

          if (needsUserTracking) {
            const updatedLead = {
              ...lead,
              criadoPorId: lead.criadoPorId || currentUser.id,
              criadoPorNome: lead.criadoPorNome || currentUser.nome,
              criadoPorEmail: lead.criadoPorEmail || currentUser.email,
              alteradoPorId: lead.alteradoPorId || currentUser.id,
              alteradoPorNome: lead.alteradoPorNome || currentUser.nome,
              alteradoPorEmail: lead.alteradoPorEmail || currentUser.email,
              dataUltimaAlteracao: lead.dataUltimaAlteracao || new Date().toISOString()
            }

            await firestoreService.update('leads', lead.id, updatedLead)
            migrated++
            console.log(`✅ Lead ${lead.nomePackiente || lead.nome_paciente} migrado`)
          }
        } catch (leadError) {
          console.error(`❌ Erro ao migrar lead ${lead.id}:`, leadError)
          errors.push({
            leadId: lead.id,
            error: leadError.message
          })
        }
      }

      console.log(`🎉 Migração de rastreamento de usuário concluída!`)
      console.log(`📈 Estatísticas: ${migrated} de ${total} leads migrados`)

      return {
        success: true,
        message: `Migração concluída! ${migrated} de ${total} leads atualizados.`,
        stats: { total, migrated, errors: errors.length }
      }
    } catch (error) {
      console.error('❌ Erro na migração de rastreamento de usuário:', error)
      return {
        success: false,
        message: `Erro na migração: ${error.message}`,
        stats: { total: 0, migrated: 0, errors: 1 }
      }
    }
  }

  async migrateLeadsForTags() {
    if (!this.useFirebase) {
      console.log('Migração só funciona com Firebase ativo')
      return { success: false, message: 'Firebase não está ativo' }
    }

    try {
      console.log('🔄 Iniciando migração de tags...')

      const rawLeads = await firestoreService.getAll('leads')
      console.log(`📊 Encontrados ${rawLeads.length} leads para análise`)

      let migrated = 0
      let total = rawLeads.length
      const errors = []

      for (const lead of rawLeads) {
        try {
          if (!lead.hasOwnProperty('tags')) {
            const updatedLead = {
              ...lead,
              tags: []
            }

            await firestoreService.update('leads', lead.id, updatedLead)
            migrated++
            console.log(`✅ Lead ${lead.nomePackiente || lead.nome_paciente} migrado`)
          }
        } catch (leadError) {
          console.error(`❌ Erro ao migrar lead ${lead.id}:`, leadError)
          errors.push({
            leadId: lead.id,
            error: leadError.message
          })
        }
      }

      console.log(`🎉 Migração de tags concluída!`)
      console.log(`📈 Estatísticas: ${migrated} de ${total} leads migrados`)

      return {
        success: true,
        message: `Migração concluída! ${migrated} de ${total} leads atualizados.`,
        stats: { total, migrated, errors: errors.length }
      }
    } catch (error) {
      console.error('❌ Erro na migração de tags:', error)
      return {
        success: false,
        message: `Erro na migração: ${error.message}`,
        stats: { total: 0, migrated: 0, errors: 1 }
      }
    }
  }

  async createTag(tagData) {
    if (!this.useFirebase) {
      console.log('Tags só funcionam com Firebase ativo')
      throw new Error('Firebase não está ativo')
    }

    try {
      const firebaseData = this.transformToFirebase('tags', tagData)
      const result = await firestoreService.create('tags', firebaseData)
      this.invalidateCache('tags')

      log('✅ Tag criada:', result.id)
      return { success: true, id: result.id }
    } catch (error) {
      console.error('❌ Erro ao criar tag:', error)
      throw error
    }
  }

  async updateTag(id, tagData) {
    if (!this.useFirebase) {
      console.log('Tags só funcionam com Firebase ativo')
      throw new Error('Firebase não está ativo')
    }

    try {
      // Parcial: enviar só o que o form edita — o transform completo reescrevia
      // dataCriacao para "agora" e reativava tag inativa a cada edição
      const firebaseData = this.transformPartialToFirebase('tags', tagData)
      await firestoreService.update('tags', id, firebaseData)
      this.invalidateCache('tags')

      log('✅ Tag atualizada:', id)
      return { success: true }
    } catch (error) {
      console.error('❌ Erro ao atualizar tag:', error)
      throw error
    }
  }

  async deleteTag(id) {
    if (!this.useFirebase) {
      console.log('Tags só funcionam com Firebase ativo')
      throw new Error('Firebase não está ativo')
    }

    try {
      log('🗑️ Excluindo tag:', id)

      const rawLeads = await firestoreService.getAll('leads')
      let leadsUpdated = 0

      for (const lead of rawLeads) {
        if (lead.tags && lead.tags.includes(id)) {
          const updatedTags = lead.tags.filter(tagId => tagId !== id)
          // Payload mínimo: só o campo tags (antes regravava o doc inteiro,
          // incluindo o campo espúrio 'id')
          await firestoreService.update('leads', lead.id, { tags: updatedTags })
          leadsUpdated++
        }
      }

      await firestoreService.delete('tags', id)
      this.invalidateCache('tags')
      this.invalidateCache('leads')

      log(`✅ Tag excluída. ${leadsUpdated} leads atualizados.`)
      return { success: true, leadsUpdated }
    } catch (error) {
      console.error('❌ Erro ao excluir tag:', error)
      throw error
    }
  }

  async updateLeadTags(leadId, tags) {
    if (!this.useFirebase) {
      console.log('Tags só funcionam com Firebase ativo')
      throw new Error('Firebase não está ativo')
    }

    try {
      // Payload mínimo: só tags. Não precisa baixar o doc nem regravar tudo —
      // updateDoc mescla e o resto do documento permanece intacto.
      await firestoreService.update('leads', leadId, { tags: tags || [] })
      this.invalidateCache('leads')

      log('✅ Tags do lead atualizadas:', leadId)
      return { success: true }
    } catch (error) {
      console.error('❌ Erro ao atualizar tags do lead:', error)
      throw error
    }
  }

  async getLeadsByTags(tagIds) {
    if (!this.useFirebase) {
      console.log('Tags só funcionam com Firebase ativo')
      return []
    }

    try {
      const rawLeads = await firestoreService.getAll('leads')
      const filteredLeads = []

      for (const lead of rawLeads) {
        if (lead.tags && tagIds.some(tagId => lead.tags.includes(tagId))) {
          const transformedLead = this.transformFromFirebase('leads', lead)
          filteredLeads.push(transformedLead)
        }
      }

      return filteredLeads
    } catch (error) {
      console.error('❌ Erro ao buscar leads por tags:', error)
      throw error
    }
  }

  async createDefaultTags() {
    if (!this.useFirebase) {
      console.log('Tags só funcionam com Firebase ativo')
      throw new Error('Firebase não está ativo')
    }

    try {
      const defaultTags = [
        { nome: 'Flacidez', cor: '#ef4444', categoria: 'Procedimento' },
        { nome: 'Ginecologia', cor: '#ec4899', categoria: 'Especialidade' },
        { nome: 'Botox', cor: '#8b5cf6', categoria: 'Procedimento' },
        { nome: 'Preenchimento', cor: '#06b6d4', categoria: 'Procedimento' },
        { nome: 'Harmonização', cor: '#10b981', categoria: 'Procedimento' },
        { nome: 'Urgente', cor: '#f59e0b', categoria: 'Prioridade' },
        { nome: 'VIP', cor: '#10b981', categoria: 'Tipo Cliente' },
        { nome: 'Primeira Visita', cor: '#3b82f6', categoria: 'Tipo Cliente' },
        { nome: 'Recorrente', cor: '#6366f1', categoria: 'Tipo Cliente' },
        { nome: 'Follow-up', cor: '#f97316', categoria: 'Prioridade' }
      ]

      const createdTags = []
      let errors = []

      for (const tagData of defaultTags) {
        try {
          const result = await this.createTag(tagData)
          createdTags.push({ id: result.id, ...tagData })
        } catch (error) {
          console.error(`Erro ao criar tag ${tagData.nome}:`, error)
          errors.push({ tag: tagData.nome, error: error.message })
        }
      }

      console.log('✅ Tags padrão criadas:', createdTags.length)

      return {
        success: true,
        message: `${createdTags.length} tags padrão criadas com sucesso!`,
        tags: createdTags,
        errors
      }
    } catch (error) {
      console.error('❌ Erro ao criar tags padrão:', error)
      throw error
    }
  }

  // ==========================================
  // FUNÇÕES EXISTENTES (CRUD)
  // ==========================================

  async migrateLeadsFields() {
    if (!this.useFirebase) {
      console.log('Migração só funciona com Firebase ativo')
      return { success: false, message: 'Firebase não está ativo' }
    }

    try {
      console.log('🚀 Iniciando migração de campos dos leads...')

      const rawLeads = await firestoreService.getAll('leads')
      console.log(`📊 Encontrados ${rawLeads.length} leads para análise`)

      let migratedCount = 0
      const errors = []
      const currentUser = this.getCurrentUserInfo()

      for (const lead of rawLeads) {
        try {
          console.log(`🔍 Analisando lead: ${lead.nomePackiente || lead.nome_paciente} (ID: ${lead.id})`)

          const needsMigration = (
            lead.valorFechadoParcial === undefined ||
            lead.followup1Realizado === undefined ||
            lead.followup1Data === undefined ||
            lead.followup2Realizado === undefined ||
            lead.followup2Data === undefined ||
            lead.followup3Realizado === undefined ||
            lead.followup3Data === undefined ||
            lead.tags === undefined ||
            lead.criadoPorId === undefined ||
            lead.alteradoPorId === undefined ||
            !lead.outrosProfissionais ||
            !Array.isArray(lead.outrosProfissionais) ||
            lead.outrosProfissionais.length !== 5 ||
            lead.outrosProfissionais.some(prof =>
              !prof.hasOwnProperty('procedimentoId') ||
              !prof.hasOwnProperty('valorAgendamento') || // ✅ CORRIGIDO
              !prof.hasOwnProperty('localAgendado')
            )
          )

          if (needsMigration) {
            console.log(`⚡ Migrando lead: ${lead.nomePackiente || lead.nome_paciente}`)

            const updatedLead = {
              nomePackiente: lead.nomePackiente || lead.nome_paciente || '',
              telefone: lead.telefone || '',
              dataNascimento: lead.dataNascimento || lead.data_nascimento || '',
              email: lead.email || '',
              canalContato: lead.canalContato || lead.canal_contato || '',
              solicitacaoPaciente: lead.solicitacaoPaciente || lead.solicitacao_paciente || '',
              medicoAgendadoId: lead.medicoAgendadoId || lead.medico_agendado_id || '',
              especialidadeId: lead.especialidadeId || lead.especialidade_id || '',
              procedimentoAgendadoId: lead.procedimentoAgendadoId || lead.procedimento_agendado_id || '',
              agendado: lead.agendado || false,
              motivoNaoAgendamento: lead.motivoNaoAgendamento || lead.motivo_nao_agendamento || '',
              outrosProfissionaisAgendados: lead.outrosProfissionaisAgendados || lead.outros_profissionais_agendados || false,
              quaisProfissionais: lead.quaisProfissionais || lead.quais_profissionais || '',
              pagouReserva: lead.pagouReserva || lead.pagou_reserva || false,
              tipoVisita: lead.tipoVisita || lead.tipo_visita || '',
              valorOrcado: lead.valorOrcado || lead.valor_orcado || 0,
              orcamentoFechado: lead.orcamentoFechado || lead.orcamento_fechado || '',
              observacaoGeral: lead.observacaoGeral || lead.observacao_geral || '',
              perfilComportamentalDisc: lead.perfilComportamentalDisc || lead.perfil_comportamental_disc || '',
              status: lead.status || 'Sem Interação',
              dataRegistroContato: lead.dataRegistroContato || lead.data_registro_contato || new Date().toISOString(),

              valorFechadoParcial: lead.valorFechadoParcial || lead.valor_fechado_parcial || 0,
              followup1Realizado: lead.followup1Realizado || lead.followup1_realizado || false,
              followup1Data: lead.followup1Data || lead.followup1_data || '',
              followup2Realizado: lead.followup2Realizado || lead.followup2_realizado || false,
              followup2Data: lead.followup2Data || lead.followup2_data || '',
              followup3Realizado: lead.followup3Realizado || lead.followup3_realizado || false,
              followup3Data: lead.followup3Data || lead.followup3_data || '',

              tags: lead.tags || [],

              // ✅ CORRIGIDO: Campo outros profissionais com valorAgendamento
              outrosProfissionais: lead.outrosProfissionais && Array.isArray(lead.outrosProfissionais) && lead.outrosProfissionais.length === 5
                ? lead.outrosProfissionais.map(prof => ({
                  medicoId: prof.medicoId || '',
                  especialidadeId: prof.especialidadeId || '',
                  procedimentoId: prof.procedimentoId || '',
                  dataAgendamento: prof.dataAgendamento || '',
                  valorAgendamento: prof.valorAgendamento || prof.valor || '', // ✅ CORRIGIDO - aceita ambos
                  localAgendado: prof.localAgendado || '',
                  ativo: prof.ativo || false
                }))
                : [
                  { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false },
                  { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false },
                  { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false },
                  { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false },
                  { medicoId: '', especialidadeId: '', procedimentoId: '', dataAgendamento: '', valorAgendamento: '', localAgendado: '', ativo: false }
                ],

              criadoPorId: lead.criadoPorId || currentUser.id,
              criadoPorNome: lead.criadoPorNome || currentUser.nome,
              criadoPorEmail: lead.criadoPorEmail || currentUser.email,
              alteradoPorId: lead.alteradoPorId || currentUser.id,
              alteradoPorNome: lead.alteradoPorNome || currentUser.nome,
              alteradoPorEmail: lead.alteradoPorEmail || currentUser.email,
              dataUltimaAlteracao: lead.dataUltimaAlteracao || new Date().toISOString()
            }

            await firestoreService.update('leads', lead.id, updatedLead)
            migratedCount++

            console.log(`✅ Lead ${lead.nomePackiente || lead.nome_paciente} migrado com sucesso`)
          } else {
            console.log(`⏭️ Lead ${lead.nomePackiente || lead.nome_paciente} já possui todos os campos`)
          }

        } catch (leadError) {
          console.error(`❌ Erro ao migrar lead ${lead.id}:`, leadError)
          errors.push({
            leadId: lead.id,
            leadName: lead.nomePackiente || lead.nome_paciente,
            error: leadError.message
          })
        }
      }

      console.log(`🎉 Migração concluída!`)
      console.log(`📈 Estatísticas:`)
      console.log(`   - Total de leads: ${rawLeads.length}`)
      console.log(`   - Leads migrados: ${migratedCount}`)
      console.log(`   - Erros: ${errors.length}`)

      if (errors.length > 0) {
        console.log(`⚠️ Erros encontrados:`, errors)
      }

      return {
        success: true,
        message: `Migração concluída! ${migratedCount} leads foram atualizados.`,
        stats: {
          total: rawLeads.length,
          migrated: migratedCount,
          errors: errors.length
        },
        errors
      }

    } catch (error) {
      console.error('❌ Erro durante a migração:', error)
      return {
        success: false,
        message: `Erro durante a migração: ${error.message}`,
        error
      }
    }
  }

  async migrateLeadsNewFields() {
    try {
      console.log('🔄 Iniciando migração de novos campos...')
      const leads = await this.getAll('leads')
      let migrated = 0
      let errors = 0

      for (const lead of leads) {
        try {
          const needsMigration =
            lead.data_consulta_efetiva === undefined ||
            lead.valor_consulta === undefined ||
            lead.valor_taxa_reserva === undefined ||
            lead.valor_procedimento === undefined ||
            lead.identificacao_procedimento === undefined ||
            lead.visitas_por_especialidade === undefined

          if (!needsMigration) continue

          const updates = {}
          if (lead.data_consulta_efetiva === undefined) updates.data_consulta_efetiva = ''
          if (lead.valor_consulta === undefined) updates.valor_consulta = ''
          if (lead.valor_taxa_reserva === undefined) updates.valor_taxa_reserva = ''
          if (lead.valor_procedimento === undefined) updates.valor_procedimento = ''
          if (lead.identificacao_procedimento === undefined) updates.identificacao_procedimento = ''
          if (lead.visitas_por_especialidade === undefined) updates.visitas_por_especialidade = {}

          // Adicionar tags vazias a visitas sem tags
          if (lead.historico_visitas && lead.historico_visitas.length > 0) {
            const needsTagMigration = lead.historico_visitas.some(v => v.tags === undefined)
            if (needsTagMigration) {
              updates.historico_visitas = lead.historico_visitas.map(v => ({
                ...v,
                tags: v.tags || []
              }))
            }
          }

          if (Object.keys(updates).length > 0) {
            await this.update('leads', lead.id, updates)
            migrated++
          }
        } catch (err) {
          console.error(`❌ Erro ao migrar lead ${lead.nome_paciente}:`, err)
          errors++
        }
      }

      console.log(`✅ Migração concluída: ${migrated} migrados, ${errors} erros, ${leads.length} total`)
      return { total: leads.length, migrated, errors }
    } catch (err) {
      console.error('❌ Erro na migração:', err)
      throw err
    }
  }

  async initializeData() {
    if (this.useFirebase) {
      await firestoreService.initializeDefaultData()
    } else {
      this.initializeLocalStorageData()
    }
  }

  initializeLocalStorageData() {
    if (!localStorage.getItem('younv_especialidades')) {
      const especialidades = [
        { id: '1', nome: 'Dermatologia', descricao: 'Cuidados com a pele', ativo: true },
        { id: '2', nome: 'Cardiologia', descricao: 'Cuidados cardíacos', ativo: true }
      ]
      localStorage.setItem('younv_especialidades', JSON.stringify(especialidades))
    }

    if (!localStorage.getItem('younv_medicos')) {
      const medicos = [
        {
          id: '1',
          nome: 'Dr. João Silva',
          crm: '12345-SP',
          telefone: '(11) 99999-9999',
          email: 'joao@clinica.com',
          especialidade_id: '1',
          ativo: true,
          data_cadastro: new Date().toISOString()
        }
      ]
      localStorage.setItem('younv_medicos', JSON.stringify(medicos))
    }

    if (!localStorage.getItem('younv_procedimentos')) {
      const procedimentos = [
        {
          id: '1',
          nome: 'Consulta Dermatológica',
          valor: 200,
          duracao: 30,
          categoria: 'Consulta',
          especialidade_id: '1',
          ativo: true
        }
      ]
      localStorage.setItem('younv_procedimentos', JSON.stringify(procedimentos))
    }

    if (!localStorage.getItem('younv_leads')) {
      localStorage.setItem('younv_leads', JSON.stringify([]))
    }
    if (!localStorage.getItem('younv_carteiras_gestao')) {
      localStorage.setItem('younv_carteiras_gestao', JSON.stringify([]))
    }
    if (!localStorage.getItem('younv_tags')) {
      localStorage.setItem('younv_tags', JSON.stringify([]))
    }
    if (!localStorage.getItem('younv_pos_consulta')) {
      localStorage.setItem('younv_pos_consulta', JSON.stringify([]))
    }
    if (!localStorage.getItem('younv_lembretes')) {
      localStorage.setItem('younv_lembretes', JSON.stringify([]))
    }
  }

  async getAll(entity) {
    if (this.useFirebase) {
      // Cache: devolve resultado recente sem novo round-trip
      const cached = this._cache.get(entity)
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return [...cached.data]
      }
      // Dedupe: se já existe uma busca em andamento para a mesma entidade
      // (ex.: Header + Sidebar + página pedindo 'leads' ao mesmo tempo), compartilha a Promise
      if (this._inflight.has(entity)) {
        const data = await this._inflight.get(entity)
        return [...data]
      }
      const fetchPromise = (async () => {
        let orderField = 'createdAt'
        if (entity === 'leads') {
          orderField = 'dataRegistroContato'
        } else if (entity === 'lembretes') {
          orderField = 'dataLembrete'
        }
        const data = await firestoreService.getAll(this.getCollectionName(entity), orderField, 'desc')
        return data.map(item => this.transformFromFirebase(entity, item))
      })()
      this._inflight.set(entity, fetchPromise)
      try {
        const data = await fetchPromise
        this._cache.set(entity, { data, ts: Date.now() })
        return [...data]
      } catch (error) {
        // Não mascarar erro de leitura com localStorage vazio — a tela deve mostrar o erro,
        // não uma lista vazia fingindo sucesso.
        console.error(`❌ Erro ao buscar ${entity} do Firebase:`, error)
        throw error
      } finally {
        this._inflight.delete(entity)
      }
    } else {
      return this.getFromLocalStorage(entity)
    }
  }

  async getById(entity, id) {
    if (this.useFirebase) {
      try {
        const data = await firestoreService.getById(this.getCollectionName(entity), id)
        return data ? this.transformFromFirebase(entity, data) : null
      } catch (error) {
        console.error('Erro ao buscar dados do Firebase, usando localStorage como fallback')
        const items = this.getFromLocalStorage(entity)
        return items.find(item => item.id === id)
      }
    } else {
      const items = this.getFromLocalStorage(entity)
      return items.find(item => item.id === id)
    }
  }

  async create(entity, item) {
    if (this.useFirebase) {
      try {
        const currentUser = this.getCurrentUserInfo()
        // Não sobrescrever dados de usuário se já estiverem preenchidos
        const itemWithUserInfo = {
          ...item,
          criado_por_id: item.criado_por_id || currentUser.id,
          criado_por_nome: item.criado_por_nome || currentUser.nome,
          criado_por_email: item.criado_por_email || currentUser.email,
          alterado_por_id: item.alterado_por_id || currentUser.id,
          alterado_por_nome: item.alterado_por_nome || currentUser.nome,
          alterado_por_email: item.alterado_por_email || currentUser.email,
          data_ultima_alteracao: item.data_ultima_alteracao || new Date().toISOString()
        }

        const firebaseData = this.transformToFirebase(entity, itemWithUserInfo)
        const result = await firestoreService.create(this.getCollectionName(entity), firebaseData)
        this.invalidateCache(entity)
        return this.transformFromFirebase(entity, result)
      } catch (error) {
        // NUNCA cair para localStorage em produção: o usuário veria "salvo" mas o dado
        // não existiria no Firestore (perda silenciosa). Propaga para a UI tratar.
        console.error(`❌ Erro ao criar ${entity} no Firebase:`, error)
        throw error
      }
    } else {
      return this.createInLocalStorage(entity, item)
    }
  }

  async update(entity, id, updatedItem) {
    if (this.useFirebase) {
      try {
        log(`🔄 update ${entity} ${id}`)

        const currentUser = this.getCurrentUserInfo()
        // IMPORTANTE: transformação PARCIAL — envia só os campos presentes em updatedItem.
        // Usar transformToFirebase aqui gerava o documento inteiro com defaults e
        // sobrescrevia (apagava) os demais campos do doc a cada update parcial.
        const updatedFirebaseData = this.transformPartialToFirebase(entity, updatedItem)

        // updateDoc do Firestore só substitui os campos enviados — não precisamos baixar
        // o doc atual antes (eliminado 1 round-trip). Apenas garantimos que campos de
        // criação não sejam sobrescritos: omitimos eles do payload.
        const finalUpdateData = {
          ...updatedFirebaseData,
          ...(entity === 'leads' && {
            alteradoPorId: currentUser.id,
            alteradoPorNome: currentUser.nome,
            alteradoPorEmail: currentUser.email,
            dataUltimaAlteracao: new Date().toISOString()
          })
        }
        // Não sobrescrever campos imutáveis de criação
        delete finalUpdateData.createdAt
        if (entity === 'leads') {
          delete finalUpdateData.criadoPorId
          delete finalUpdateData.criadoPorNome
          delete finalUpdateData.criadoPorEmail
          delete finalUpdateData.dataRegistroContato
        }

        await firestoreService.update(this.getCollectionName(entity), id, finalUpdateData)
        this.invalidateCache(entity)

        // IMPORTANTE: retornar APENAS o que foi enviado (eco do payload parcial, em snake_case).
        // Antes retornava transformFromFirebase(payloadParcial), que re-hidratava o objeto
        // INTEIRO com defaults ('' / 0 / []) — o merge otimista das telas ({...lead, ...retorno})
        // então zerava historico_visitas/total_visitas/criado_por em memória, e um drag no
        // Kanban gravava esse objeto corrompido de volta no Firestore (perda permanente).
        const echo = { id, ...updatedItem }
        if (entity === 'leads') {
          const cu = this.getCurrentUserInfo()
          echo.alterado_por_id = cu.id
          echo.alterado_por_nome = cu.nome
          echo.alterado_por_email = cu.email
          echo.data_ultima_alteracao = new Date().toISOString()
          // Campos imutáveis nunca entram no eco (não foram gravados)
          delete echo.criado_por_id
          delete echo.criado_por_nome
          delete echo.criado_por_email
          delete echo.data_registro_contato
        }
        delete echo.createdAt
        return echo
      } catch (error) {
        // Propaga o erro — cair para localStorage fazia a UI mostrar sucesso
        // sem nada ter sido gravado no Firestore (perda silenciosa de dados).
        console.error(`❌ Erro ao atualizar ${entity} no Firebase:`, error.message)
        throw error
      }
    } else {
      return this.updateInLocalStorage(entity, id, updatedItem)
    }
  }

  async delete(entity, id) {
    if (this.useFirebase) {
      try {
        const result = await firestoreService.delete(this.getCollectionName(entity), id)
        this.invalidateCache(entity)
        return result
      } catch (error) {
        // Propagar: deletar "só no localStorage" fazia a UI sumir com o item
        // enquanto ele continuava existindo no Firestore.
        console.error(`❌ Erro ao deletar ${entity} no Firebase:`, error)
        throw error
      }
    } else {
      return this.deleteFromLocalStorage(entity, id)
    }
  }

  getFromLocalStorage(entity) {
    const key = `younv_${entity}`
    const data = localStorage.getItem(key)
    const items = data ? JSON.parse(data) : []

    if (entity === 'leads') {
      return items.sort((a, b) => {
        const dateA = new Date(a.data_registro_contato || a.createdAt || 0)
        const dateB = new Date(b.data_registro_contato || b.createdAt || 0)
        return dateB - dateA
      })
    }

    return items
  }

  createInLocalStorage(entity, item) {
    const items = this.getFromLocalStorage(entity)
    const currentUser = this.getCurrentUserInfo()

    const newItem = {
      ...item,
      id: Date.now().toString(),
      data_registro_contato: item.data_registro_contato || new Date().toISOString(),
      criado_por_id: currentUser.id,
      criado_por_nome: currentUser.nome,
      criado_por_email: currentUser.email,
      alterado_por_id: currentUser.id,
      alterado_por_nome: currentUser.nome,
      alterado_por_email: currentUser.email,
      data_ultima_alteracao: new Date().toISOString(),
      // ✅ CORRIGIDO: Garantir estrutura de outros profissionais no localStorage
      outros_profissionais: item.outros_profissionais || [
        { medico_id: '', especialidade_id: '', procedimento_id: '', data_agendamento: '', valor_agendamento: '', local_agendado: '', ativo: false },
        { medico_id: '', especialidade_id: '', procedimento_id: '', data_agendamento: '', valor_agendamento: '', local_agendado: '', ativo: false },
        { medico_id: '', especialidade_id: '', procedimento_id: '', data_agendamento: '', valor_agendamento: '', local_agendado: '', ativo: false },
        { medico_id: '', especialidade_id: '', procedimento_id: '', data_agendamento: '', valor_agendamento: '', local_agendado: '', ativo: false },
        { medico_id: '', especialidade_id: '', procedimento_id: '', data_agendamento: '', valor_agendamento: '', local_agendado: '', ativo: false }
      ]
    }
    items.push(newItem)
    localStorage.setItem(`younv_${entity}`, JSON.stringify(items))
    return newItem
  }

  updateInLocalStorage(entity, id, updatedItem) {
    const items = this.getFromLocalStorage(entity)
    const index = items.findIndex(item => item.id === id)
    if (index !== -1) {
      const currentUser = this.getCurrentUserInfo()
      const currentItem = items[index]

      items[index] = {
        ...currentItem,
        ...updatedItem,
        criado_por_id: currentItem.criado_por_id,
        criado_por_nome: currentItem.criado_por_nome,
        criado_por_email: currentItem.criado_por_email,
        data_registro_contato: currentItem.data_registro_contato,
        alterado_por_id: currentUser.id,
        alterado_por_nome: currentUser.nome,
        alterado_por_email: currentUser.email,
        data_ultima_alteracao: new Date().toISOString()
      }
      localStorage.setItem(`younv_${entity}`, JSON.stringify(items))

      console.log(`✅ ${entity} ${id} atualizado no localStorage preservando dados originais`)
      return items[index]
    }
    return null
  }

  deleteFromLocalStorage(entity, id) {
    const items = this.getFromLocalStorage(entity)
    const filteredItems = items.filter(item => item.id !== id)
    localStorage.setItem(`younv_${entity}`, JSON.stringify(filteredItems))
    return true
  }

  async getLeadsByPeriod(startDate, endDate) {
    if (this.useFirebase) {
      try {
        const data = await firestoreService.getLeadsByPeriod(startDate, endDate)
        return data.map(item => this.transformFromFirebase('leads', item))
      } catch (error) {
        console.error('Erro ao buscar leads por período no Firebase')
        const leads = this.getFromLocalStorage('leads')
        return leads.filter(lead => {
          const leadDate = new Date(lead.data_registro_contato)
          return leadDate >= new Date(startDate) && leadDate <= new Date(endDate)
        })
      }
    } else {
      const leads = this.getFromLocalStorage('leads')
      return leads.filter(lead => {
        const leadDate = new Date(lead.data_registro_contato)
        return leadDate >= new Date(startDate) && leadDate <= new Date(endDate)
      })
    }
  }

  async getConversionRate() {
    if (this.useFirebase) {
      try {
        return await firestoreService.getConversionRate()
      } catch (error) {
        console.error('Erro ao calcular taxa de conversão no Firebase')
        const leads = this.getFromLocalStorage('leads')
        const total = leads.length
        const converted = leads.filter(lead => lead.status === 'Convertido').length
        return total > 0 ? (converted / total * 100).toFixed(1) : 0
      }
    } else {
      const leads = this.getFromLocalStorage('leads')
      const total = leads.length
      const converted = leads.filter(lead => lead.status === 'Convertido').length
      return total > 0 ? (converted / total * 100).toFixed(1) : 0
    }
  }
}

export default new FirebaseDataService()
