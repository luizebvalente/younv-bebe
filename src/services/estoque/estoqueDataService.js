import firebaseDataService from '../firebaseDataService'
import estoqueMinimoPorLocalService from './estoqueMinimoPorLocal'

/**
 * Serviço de dados para o módulo de Estoque - VERSÃO COM ESTOQUE MÍNIMO POR LOCAL
 * Gerencia todas as operações CRUD relacionadas ao estoque
 */
class EstoqueDataService {
  // Collections do Firestore
  collections = {
    produtos: 'produtos',
    lotes: 'lotes',
    estoques: 'estoques',
    movimentacoes: 'movimentacoes_estoque',
    kits: 'kits',
    kitsItens: 'kits_itens',
    fornecedores: 'fornecedores',
    categorias: 'categorias_produtos',
    alertas: 'alertas_estoque',
    // Coleções do CRM usadas pelo estoque (baixa por profissional / relatórios)
    medicos: 'medicos',
    especialidades: 'especialidades'
  }

  // ==================== PRODUTOS ====================
  
  async getProdutos() {
    return await firebaseDataService.getAll(this.collections.produtos)
  }

  async getProdutoById(id) {
    return await firebaseDataService.getById(this.collections.produtos, id)
  }

  async createProduto(data) {
    const produto = {
      ...data,
      data_cadastro: new Date().toISOString(),
      ativo: true,
      estoque_atual: 0
    }
    return await firebaseDataService.create(this.collections.produtos, produto)
  }

  async updateProduto(id, data) {
    return await firebaseDataService.update(this.collections.produtos, id, {
      ...data,
      data_atualizacao: new Date().toISOString()
    })
  }

  async deleteProduto(id) {
    return await firebaseDataService.delete(this.collections.produtos, id)
  }

  // ==================== LOTES ====================
  
  async getLotes() {
    return await firebaseDataService.getAll(this.collections.lotes)
  }

  async getLotesByProduto(produtoId) {
    const todosLotes = await firebaseDataService.getAll(this.collections.lotes)
    return todosLotes.filter(lote => lote.produto_id === produtoId)
  }

  async getLotesVencendo(dias) {
    const dataLimite = new Date()
    dataLimite.setDate(dataLimite.getDate() + dias)
    
    const todosLotes = await firebaseDataService.getAll(this.collections.lotes)
    
    return todosLotes.filter(lote => {
      if (!lote.data_validade || !lote.quantidade_atual || lote.quantidade_atual <= 0) {
        return false
      }
      
      const dataValidade = new Date(lote.data_validade)
      return dataValidade <= dataLimite
    })
  }

  async createLote(data) {
    const lote = {
      ...data,
      data_cadastro: new Date().toISOString(),
      quantidade_atual: data.quantidade_inicial,
      status: 'ativo'
    }
    return await firebaseDataService.create(this.collections.lotes, lote)
  }

  async updateLote(id, data) {
    return await firebaseDataService.update(this.collections.lotes, id, {
      ...data,
      data_atualizacao: new Date().toISOString()
    })
  }

  async deleteLote(id) {
    return await firebaseDataService.delete(this.collections.lotes, id)
  }

  async getLoteById(id) {
    return await firebaseDataService.getById(this.collections.lotes, id)
  }

  // ==================== ESTOQUES (Localizações) ====================
  
  async getEstoques() {
    return await firebaseDataService.getAll(this.collections.estoques)
  }

  async getEstoqueById(id) {
    return await firebaseDataService.getById(this.collections.estoques, id)
  }

  async createEstoque(data) {
    const estoque = {
      ...data,
      data_cadastro: new Date().toISOString(),
      ativo: true
    }
    return await firebaseDataService.create(this.collections.estoques, estoque)
  }

  async updateEstoque(id, data) {
    return await firebaseDataService.update(this.collections.estoques, id, data)
  }

  async deleteEstoque(id) {
    return await firebaseDataService.delete(this.collections.estoques, id)
  }

  // ==================== MOVIMENTAÇÕES ====================
  
  async getMovimentacoes() {
    return await firebaseDataService.getAll(this.collections.movimentacoes)
  }

  async getMovimentacoesByProduto(produtoId) {
    const todasMovimentacoes = await firebaseDataService.getAll(this.collections.movimentacoes)
    return todasMovimentacoes.filter(mov => mov.produto_id === produtoId)
  }

  /**
   * ✅ CORREÇÃO CRÍTICA: Cria uma movimentação de estoque
   * 
   * IMPORTANTE: Esta função NÃO atualiza automaticamente o lote
   * A atualização do lote deve ser feita explicitamente por quem chama
   */
  async createMovimentacao(data) {
    const movimentacao = {
      ...data,
      data_movimentacao: new Date().toISOString(),
      usuario: data.usuario || 'Sistema'
    }
    
    const result = await firebaseDataService.create(this.collections.movimentacoes, movimentacao)
    return result
  }

  // ==================== PROFISSIONAIS (MÉDICOS DO CRM) ====================

  /**
   * Médicos cadastrados no CRM, usados para atribuir a baixa a um profissional.
   * Só retorna os ativos — cadastros inativos não devem aparecer na baixa.
   */
  async getMedicos() {
    const medicos = await firebaseDataService.getAll(this.collections.medicos)
    return medicos
      .filter(m => m.ativo !== false)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
  }

  async getEspecialidades() {
    return await firebaseDataService.getAll(this.collections.especialidades)
  }

  /**
   * Saídas de estoque atribuídas a um profissional, opcionalmente restritas a
   * um mês (mes: 0-11) e/ou ano. Movimentações sem medico_id ficam de fora.
   */
  async getMovimentacoesPorProfissional({ ano = null, mes = null, medicoId = null } = {}) {
    const movimentacoes = await this.getMovimentacoes()

    return movimentacoes.filter(mov => {
      if (mov.tipo !== 'saida' || !mov.medico_id) return false
      if (medicoId && mov.medico_id !== medicoId) return false
      if (ano === null && mes === null) return true

      const data = new Date(mov.data_movimentacao)
      if (Number.isNaN(data.getTime())) return false
      if (ano !== null && data.getFullYear() !== ano) return false
      if (mes !== null && data.getMonth() !== mes) return false
      return true
    })
  }

  // ==================== KITS ====================
  
  async getKits() {
    return await firebaseDataService.getAll(this.collections.kits)
  }

  async getKitById(id) {
    return await firebaseDataService.getById(this.collections.kits, id)
  }

  async createKit(data) {
    const kit = {
      ...data,
      data_cadastro: new Date().toISOString(),
      ativo: true
    }
    return await firebaseDataService.create(this.collections.kits, kit)
  }

  async updateKit(id, data) {
    return await firebaseDataService.update(this.collections.kits, id, data)
  }

  async deleteKit(id) {
    return await firebaseDataService.delete(this.collections.kits, id)
  }

  // ==================== ITENS DE KITS ====================
  
  async getKitItens(kitId) {
    const todosItens = await firebaseDataService.getAll(this.collections.kitsItens)
    return todosItens.filter(item => item.kit_id === kitId)
  }

  async createKitItem(data) {
    return await firebaseDataService.create(this.collections.kitsItens, data)
  }

  async updateKitItem(id, data) {
    return await firebaseDataService.update(this.collections.kitsItens, id, data)
  }

  async deleteKitItem(id) {
    return await firebaseDataService.delete(this.collections.kitsItens, id)
  }

  // ==================== FORNECEDORES ====================
  
  async getFornecedores() {
    return await firebaseDataService.getAll(this.collections.fornecedores)
  }

  async createFornecedor(data) {
    const fornecedor = {
      ...data,
      data_cadastro: new Date().toISOString(),
      ativo: true
    }
    return await firebaseDataService.create(this.collections.fornecedores, fornecedor)
  }

  async updateFornecedor(id, data) {
    return await firebaseDataService.update(this.collections.fornecedores, id, data)
  }

  async deleteFornecedor(id) {
    return await firebaseDataService.delete(this.collections.fornecedores, id)
  }

  // ==================== CATEGORIAS ====================
  
  async getCategorias() {
    return await firebaseDataService.getAll(this.collections.categorias)
  }

  async createCategoria(data) {
    return await firebaseDataService.create(this.collections.categorias, data)
  }

  async updateCategoria(id, data) {
    return await firebaseDataService.update(this.collections.categorias, id, data)
  }

  async deleteCategoria(id) {
    return await firebaseDataService.delete(this.collections.categorias, id)
  }

  // ==================== ALERTAS ====================
  
  async getAlertas() {
    return await firebaseDataService.getAll(this.collections.alertas)
  }

  async createAlerta(data) {
    const alerta = {
      ...data,
      data_criacao: new Date().toISOString(),
      visualizado: false
    }
    return await firebaseDataService.create(this.collections.alertas, alerta)
  }

  async marcarAlertaVisualizado(id) {
    return await firebaseDataService.update(this.collections.alertas, id, {
      visualizado: true,
      data_visualizacao: new Date().toISOString()
    })
  }

  async deleteAlerta(id) {
    return await firebaseDataService.delete(this.collections.alertas, id)
  }

  // ==================== FUNÇÕES AUXILIARES ====================
  
  /**
   * Verifica disponibilidade de um kit
   */
  async verificarDisponibilidadeKit(kitId) {
    const itens = await this.getKitItens(kitId)
    const disponibilidade = []
    
    for (const item of itens) {
      const produto = await this.getProdutoById(item.produto_id)
      const disponivel = produto.estoque_atual >= item.quantidade
      
      disponibilidade.push({
        produto_id: item.produto_id,
        produto_nome: produto.nome_comercial,
        quantidade_necessaria: item.quantidade,
        quantidade_disponivel: produto.estoque_atual,
        disponivel
      })
    }
    
    return {
      disponivel: disponibilidade.every(item => item.disponivel),
      itens: disponibilidade
    }
  }

  /**
   * Baixa um kit do estoque.
   * CORRIGIDO: além de registrar a movimentação, agora DÁ BAIXA de fato —
   * consome dos lotes (FIFO por validade) e recalcula produto.estoque_atual.
   * Antes só criava a movimentação e o estoque ficava intacto (superestimado).
   */
  async baixarKit(kitId, observacao = '') {
    const disponibilidade = await this.verificarDisponibilidadeKit(kitId)

    if (!disponibilidade.disponivel) {
      throw new Error('Kit não disponível em estoque')
    }

    const itens = await this.getKitItens(kitId)
    const movimentacoes = []

    for (const item of itens) {
      // Consumir dos lotes com quantidade disponível, vencimento mais próximo primeiro (FIFO)
      const lotes = (await this.getLotesByProduto(item.produto_id))
        .filter(l => (l.quantidade_atual || 0) > 0)
        .sort((a, b) => new Date(a.data_validade || '9999-12-31') - new Date(b.data_validade || '9999-12-31'))

      let restante = item.quantidade
      for (const lote of lotes) {
        if (restante <= 0) break
        const consumir = Math.min(lote.quantidade_atual, restante)
        await this.updateLote(lote.id, { quantidade_atual: lote.quantidade_atual - consumir })
        restante -= consumir

        const movimentacao = await this.createMovimentacao({
          produto_id: item.produto_id,
          lote_id: lote.id,
          tipo: 'saida',
          quantidade: consumir,
          motivo: 'Baixa de Kit',
          kit_id: kitId,
          observacao
        })
        movimentacoes.push(movimentacao)
      }

      if (restante > 0) {
        // Sem lotes suficientes (estoque_atual do produto estava dessincronizado):
        // registra a diferença como movimentação sem lote para rastreabilidade
        const movimentacao = await this.createMovimentacao({
          produto_id: item.produto_id,
          tipo: 'saida',
          quantidade: restante,
          motivo: 'Baixa de Kit (sem lote — estoque dessincronizado)',
          kit_id: kitId,
          observacao
        })
        movimentacoes.push(movimentacao)
      }

      // Recalcular estoque_atual do produto a partir dos lotes
      const lotesAtualizados = await this.getLotesByProduto(item.produto_id)
      const novoEstoque = lotesAtualizados.reduce((sum, l) => sum + (l.quantidade_atual || 0), 0)
      await this.updateProduto(item.produto_id, { estoque_atual: novoEstoque })
    }

    return movimentacoes
  }

  /**
   * 🆕 NOVO: Gera alertas automáticos - INCLUINDO ESTOQUE POR LOCALIZAÇÃO
   */
  async gerarAlertas() {
    const alertasGerados = []

    try {
      // OTIMIZAÇÃO: buscar alertas existentes e produtos UMA vez (antes era um
      // getAll completo de alertas dentro de cada iteração — N+1 de coleção inteira)
      const alertasExistentes = await this.getAlertas()
      const produtosTodos = await this.getProdutos()
      const produtosById = new Map(produtosTodos.map(p => [p.id, p]))

      // 1. ALERTAS DE VALIDADE
      const diasParaAlertar = [30, 60, 90]

      for (const dias of diasParaAlertar) {
        const lotesVencendo = await this.getLotesVencendo(dias)

        for (const lote of lotesVencendo) {
          try {
            const produto = produtosById.get(lote.produto_id)

            if (produto) {
              const alertaExistente = alertasExistentes.find(a =>
                a.lote_id === lote.id &&
                a.tipo === 'validade' &&
                a.dias_vencimento === dias &&
                !a.visualizado
              )

              if (!alertaExistente) {
                const alerta = await this.createAlerta({
                  tipo: 'validade',
                  prioridade: dias <= 30 ? 'alta' : dias <= 60 ? 'media' : 'baixa',
                  titulo: `Produto próximo ao vencimento (${dias} dias)`,
                  mensagem: `${produto.nome_comercial} - Lote ${lote.numero_lote} vence em ${dias} dias`,
                  produto_id: produto.id,
                  lote_id: lote.id,
                  dias_vencimento: dias
                })

                alertasGerados.push(alerta)
                alertasExistentes.push(alerta)
              }
            }
          } catch (error) {
            console.error(`   ❌ Erro ao processar lote ${lote.id}:`, error)
          }
        }
      }
      
      // 2. ALERTAS DE ESTOQUE MÍNIMO GERAL (do produto)
      for (const produto of produtosTodos) {
        try {
          const estoqueAtual = produto.estoque_atual || 0
          const estoqueMinimo = produto.estoque_minimo || 0

          if (estoqueMinimo > 0 && estoqueAtual <= estoqueMinimo) {
            const alertaExistente = alertasExistentes.find(a =>
              a.produto_id === produto.id &&
              a.tipo === 'estoque_minimo' &&
              !a.visualizado
            )

            if (!alertaExistente) {
              const alerta = await this.createAlerta({
                tipo: 'estoque_minimo',
                prioridade: estoqueAtual === 0 ? 'alta' : 'media',
                titulo: estoqueAtual === 0 ? 'Estoque zerado' : 'Estoque mínimo atingido',
                mensagem: `${produto.nome_comercial} - Estoque atual: ${estoqueAtual} / Mínimo: ${estoqueMinimo}`,
                produto_id: produto.id
              })

              alertasGerados.push(alerta)
              alertasExistentes.push(alerta)
            }
          }
        } catch (error) {
          console.error(`   ❌ Erro ao processar produto ${produto.id}:`, error)
        }
      }

      // 🆕 3. ALERTAS DE ESTOQUE MÍNIMO POR LOCALIZAÇÃO
      try {
        const resultadoLocal = await estoqueMinimoPorLocalService.gerarAlertasAutomaticos(this)

        if (resultadoLocal.success) {
          alertasGerados.push(...resultadoLocal.alertas)
        }
      } catch (error) {
        console.error('   ❌ Erro ao gerar alertas de localização:', error)
      }

      return alertasGerados
      
    } catch (error) {
      console.error('❌ Erro geral na geração de alertas:', error)
      throw error
    }
  }

  /**
   * Calcula estatísticas do estoque
   */
  async getEstatisticas() {
    const produtos = await this.getProdutos()
    const lotes = await this.getLotes()
    const movimentacoes = await this.getMovimentacoes()
    
    const hoje = new Date()
    const movimentacoesHoje = movimentacoes.filter(m => {
      const dataMovimentacao = new Date(m.data_movimentacao)
      return dataMovimentacao.toDateString() === hoje.toDateString()
    })
    
    return {
      total_produtos: produtos.length,
      produtos_ativos: produtos.filter(p => p.ativo).length,
      total_lotes: lotes.length,
      lotes_ativos: lotes.filter(l => l.status === 'ativo').length,
      movimentacoes_hoje: movimentacoesHoje.length,
      entradas_hoje: movimentacoesHoje.filter(m => m.tipo === 'entrada').length,
      saidas_hoje: movimentacoesHoje.filter(m => m.tipo === 'saida').length,
      valor_total_estoque: produtos.reduce((total, p) => {
        return total + (p.estoque_atual * (p.valor_unitario || 0))
      }, 0)
    }
  }
}

export default new EstoqueDataService()
