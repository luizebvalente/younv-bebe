/**
 * 🏪 SERVIÇO DE ESTOQUE MÍNIMO POR LOCALIZAÇÃO
 * 
 * Este serviço gerencia configurações de estoque mínimo específicas para cada
 * combinação de produto + localização, permitindo controle granular do estoque.
 * 
 * Estrutura de dados:
 * - produto_id: ID do produto
 * - estoque_id: ID da localização
 * - quantidade_minima: Quantidade mínima desejada neste local
 * - quantidade_ideal: Quantidade ideal para reposição
 * - prioridade: alta/media/baixa (importância desta localização)
 * - ativo: Se esta regra está ativa
 */

import firebaseDataService from '../firebaseDataService'

class EstoqueMinimoPorLocalService {
  collection = 'estoque_minimo_por_local'

  /**
   * Criar ou atualizar configuração de estoque mínimo
   */
  async setEstoqueMinimo(data) {
    try {
      // Verificar se já existe configuração para este produto + localização
      const existente = await this.getByProdutoELocal(data.produto_id, data.estoque_id)
      
      const config = {
        produto_id: data.produto_id,
        estoque_id: data.estoque_id,
        quantidade_minima: parseInt(data.quantidade_minima) || 0,
        quantidade_ideal: parseInt(data.quantidade_ideal) || 0,
        prioridade: data.prioridade || 'media',
        ativo: data.ativo !== undefined ? data.ativo : true,
        observacoes: data.observacoes || '',
        data_atualizacao: new Date().toISOString()
      }

      if (existente) {
        // Atualizar existente
        await firebaseDataService.update(this.collection, existente.id, config)
        console.log('✅ Estoque mínimo atualizado:', existente.id)
        return { ...config, id: existente.id }
      } else {
        // Criar novo
        config.data_cadastro = new Date().toISOString()
        const result = await firebaseDataService.create(this.collection, config)
        console.log('✅ Estoque mínimo criado:', result.id)
        return result
      }
    } catch (error) {
      console.error('❌ Erro ao configurar estoque mínimo:', error)
      throw error
    }
  }

  /**
   * Buscar configuração específica por produto e local
   */
  async getByProdutoELocal(produtoId, estoqueId) {
    try {
      const configs = await firebaseDataService.getAll(this.collection)
      return configs.find(c => 
        c.produto_id === produtoId && 
        c.estoque_id === estoqueId
      )
    } catch (error) {
      console.error('❌ Erro ao buscar configuração:', error)
      return null
    }
  }

  /**
   * Buscar todas as configurações de um produto
   */
  async getByProduto(produtoId) {
    try {
      const configs = await firebaseDataService.getAll(this.collection)
      return configs.filter(c => c.produto_id === produtoId && c.ativo)
    } catch (error) {
      console.error('❌ Erro ao buscar configurações do produto:', error)
      return []
    }
  }

  /**
   * Buscar todas as configurações de uma localização
   */
  async getByLocal(estoqueId) {
    try {
      const configs = await firebaseDataService.getAll(this.collection)
      return configs.filter(c => c.estoque_id === estoqueId && c.ativo)
    } catch (error) {
      console.error('❌ Erro ao buscar configurações do local:', error)
      return []
    }
  }

  /**
   * Buscar todas as configurações
   */
  async getAll() {
    try {
      return await firebaseDataService.getAll(this.collection)
    } catch (error) {
      console.error('❌ Erro ao buscar todas as configurações:', error)
      return []
    }
  }

  /**
   * Excluir configuração
   */
  async delete(id) {
    try {
      await firebaseDataService.delete(this.collection, id)
      console.log('✅ Configuração excluída:', id)
      return true
    } catch (error) {
      console.error('❌ Erro ao excluir configuração:', error)
      throw error
    }
  }

  /**
   * 🚨 ANÁLISE: Verificar locais com estoque abaixo do mínimo
   * 
   * Retorna análise completa de todos os produtos que estão
   * abaixo do mínimo em cada localização
   */
  async analisarEstoqueBaixo(estoqueDataService) {
    try {
      console.log('🔍 Iniciando análise de estoque baixo por localização...')
      
      const [configs, produtos, lotes, estoques] = await Promise.all([
        this.getAll(),
        estoqueDataService.getProdutos(),
        estoqueDataService.getLotes(),
        estoqueDataService.getEstoques()
      ])

      const alertas = []
      const configsAtivas = configs.filter(c => c.ativo)

      console.log(`📊 Analisando ${configsAtivas.length} configurações ativas...`)

      for (const config of configsAtivas) {
        // Buscar produto e estoque
        const produto = produtos.find(p => p.id === config.produto_id)
        const estoque = estoques.find(e => e.id === config.estoque_id)

        if (!produto || !estoque) continue

        // Calcular estoque atual nesta localização
        const lotesDoLocal = lotes.filter(l => 
          l.produto_id === config.produto_id && 
          l.estoque_id === config.estoque_id &&
          l.quantidade_atual > 0
        )

        const quantidadeAtual = lotesDoLocal.reduce((sum, lote) => 
          sum + (lote.quantidade_atual || 0), 0
        )

        // Verificar se está abaixo do mínimo
        if (quantidadeAtual < config.quantidade_minima) {
          const deficit = config.quantidade_minima - quantidadeAtual
          const deficitIdeal = config.quantidade_ideal - quantidadeAtual

          // Buscar outros locais que têm este produto
          const outrosLocaisComEstoque = []
          
          for (const outroEstoque of estoques) {
            if (outroEstoque.id === config.estoque_id) continue

            const lotesOutroLocal = lotes.filter(l =>
              l.produto_id === config.produto_id &&
              l.estoque_id === outroEstoque.id &&
              l.quantidade_atual > 0
            )

            const qtdOutroLocal = lotesOutroLocal.reduce((sum, l) => 
              sum + (l.quantidade_atual || 0), 0
            )

            if (qtdOutroLocal > 0) {
              outrosLocaisComEstoque.push({
                estoque_id: outroEstoque.id,
                estoque_nome: outroEstoque.nome,
                estoque_tipo: outroEstoque.tipo,
                quantidade_disponivel: qtdOutroLocal,
                lotes: lotesOutroLocal
              })
            }
          }

          // Criar alerta
          alertas.push({
            prioridade: config.prioridade,
            produto_id: produto.id,
            produto_nome: produto.nome_comercial,
            estoque_id: estoque.id,
            estoque_nome: estoque.nome,
            estoque_tipo: estoque.tipo,
            quantidade_atual: quantidadeAtual,
            quantidade_minima: config.quantidade_minima,
            quantidade_ideal: config.quantidade_ideal,
            deficit: deficit,
            deficit_ideal: deficitIdeal,
            percentual_falta: ((deficit / config.quantidade_minima) * 100).toFixed(1),
            pode_transferir: outrosLocaisComEstoque.length > 0,
            locais_com_estoque: outrosLocaisComEstoque,
            sugestao_transferencia: this.gerarSugestaoTransferencia(
              deficit,
              deficitIdeal,
              outrosLocaisComEstoque
            )
          })
        }
      }

      // Ordenar por prioridade
      const ordenacao = { alta: 1, media: 2, baixa: 3 }
      alertas.sort((a, b) => {
        const prioA = ordenacao[a.prioridade] || 99
        const prioB = ordenacao[b.prioridade] || 99
        if (prioA !== prioB) return prioA - prioB
        return b.deficit - a.deficit
      })

      console.log(`🚨 Encontrados ${alertas.length} alertas de estoque baixo`)

      return {
        total_alertas: alertas.length,
        alertas_alta: alertas.filter(a => a.prioridade === 'alta').length,
        alertas_media: alertas.filter(a => a.prioridade === 'media').length,
        alertas_baixa: alertas.filter(a => a.prioridade === 'baixa').length,
        alertas
      }
    } catch (error) {
      console.error('❌ Erro ao analisar estoque baixo:', error)
      throw error
    }
  }

  /**
   * Gerar sugestão inteligente de transferência
   */
  gerarSugestaoTransferencia(deficit, deficitIdeal, locaisComEstoque) {
    if (locaisComEstoque.length === 0) {
      return {
        possivel: false,
        mensagem: '⚠️ Nenhum outro local possui estoque deste produto. Necessário compra.'
      }
    }

    // Ordenar locais por quantidade disponível (maior primeiro)
    const locaisOrdenados = [...locaisComEstoque].sort((a, b) => 
      b.quantidade_disponivel - a.quantidade_disponivel
    )

    // Sugerir transferência do local com mais estoque
    const melhorLocal = locaisOrdenados[0]
    const quantidadeSugerida = Math.min(deficitIdeal, melhorLocal.quantidade_disponivel)

    return {
      possivel: true,
      origem_id: melhorLocal.estoque_id,
      origem_nome: melhorLocal.estoque_nome,
      quantidade_sugerida: quantidadeSugerida,
      quantidade_disponivel_origem: melhorLocal.quantidade_disponivel,
      atende_ideal: quantidadeSugerida >= deficitIdeal,
      mensagem: `💡 Sugestão: Transferir ${quantidadeSugerida} unidades de "${melhorLocal.estoque_nome}"`
    }
  }

  /**
   * 🔔 Gerar alertas automáticos no sistema
   */
  async gerarAlertasAutomaticos(estoqueDataService) {
    try {
      console.log('🔔 Gerando alertas automáticos de estoque mínimo por local...')
      
      const analise = await this.analisarEstoqueBaixo(estoqueDataService)
      const alertasGerados = []

      // Buscar alertas existentes UMA vez (antes era um getAll completo por item — N+1)
      const alertasExistentes = await estoqueDataService.getAlertas()

      for (const item of analise.alertas) {
        // Verificar se já existe alerta não visualizado para este produto + local
        const alertaExistente = alertasExistentes.find(a =>
          a.produto_id === item.produto_id &&
          a.estoque_id === item.estoque_id &&
          a.tipo === 'estoque_minimo_local' &&
          !a.visualizado
        )

        if (!alertaExistente) {
          const alerta = await estoqueDataService.createAlerta({
            tipo: 'estoque_minimo_local',
            prioridade: item.prioridade,
            titulo: `Estoque baixo em ${item.estoque_nome}`,
            mensagem: `${item.produto_nome}: ${item.quantidade_atual}/${item.quantidade_minima} (faltam ${item.deficit} unidades)`,
            produto_id: item.produto_id,
            estoque_id: item.estoque_id,
            dados_adicionais: {
              quantidade_atual: item.quantidade_atual,
              quantidade_minima: item.quantidade_minima,
              quantidade_ideal: item.quantidade_ideal,
              deficit: item.deficit,
              pode_transferir: item.pode_transferir,
              sugestao: item.sugestao_transferencia
            }
          })

          alertasGerados.push(alerta)
          alertasExistentes.push(alerta)
        }
      }

      console.log(`🎉 ${alertasGerados.length} novos alertas gerados`)

      return {
        success: true,
        total: alertasGerados.length,
        alertas: alertasGerados,
        analise
      }
    } catch (error) {
      console.error('❌ Erro ao gerar alertas automáticos:', error)
      throw error
    }
  }
}

export default new EstoqueMinimoPorLocalService()
