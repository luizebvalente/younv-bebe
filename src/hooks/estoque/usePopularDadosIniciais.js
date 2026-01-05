import { useState } from 'react'
import estoqueDataService from '@/services/estoque/estoqueDataService'

/**
 * Hook para popular dados iniciais do sistema de estoque
 */
export function usePopularDadosIniciais() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const popularCategorias = async () => {
    const categorias = [
      { nome: 'Injeção', descricao: 'Medicamentos e substâncias injetáveis' },
      { nome: 'Soroterapia', descricao: 'Produtos para soroterapia e hidratação' },
      { nome: 'Dermatologia', descricao: 'Produtos dermatológicos e estéticos' },
      { nome: 'Nutrição', descricao: 'Suplementos e produtos nutricionais' },
      { nome: 'Kits', descricao: 'Kits e protocolos completos' },
      { nome: 'Descartáveis', descricao: 'Materiais descartáveis e consumíveis' },
      { nome: 'Botox e Toxinas', descricao: 'Toxinas botulínicas e similares' },
      { nome: 'Preenchimento', descricao: 'Ácido hialurônico e preenchedores' },
      { nome: 'Bioestimuladores', descricao: 'Bioestimuladores de colágeno' },
      { nome: 'Vitaminas', descricao: 'Vitaminas e complexos vitamínicos' },
      { nome: 'Hormônios', descricao: 'Terapia hormonal e implantes' },
      { nome: 'Antioxidantes', descricao: 'Antioxidantes e anti-aging' },
      { nome: 'Skin Care', descricao: 'Produtos para cuidados com a pele' },
      { nome: 'Hair Care', descricao: 'Produtos para tratamento capilar' },
      { nome: 'Equipamentos', descricao: 'Equipamentos e dispositivos médicos' }
    ]

    const results = []
    for (const cat of categorias) {
      try {
        const result = await estoqueDataService.createCategoria(cat)
        results.push(result)
      } catch (err) {
        console.error(`Erro ao criar categoria ${cat.nome}:`, err)
      }
    }

    return results
  }

  const popularFornecedores = async () => {
    const fornecedores = [
      {
        nome: 'Allergan',
        cnpj: '00.000.000/0001-00',
        contato: 'Departamento Comercial',
        telefone: '(11) 0000-0000',
        email: 'contato@allergan.com',
        especialidade: 'Toxinas botulínicas e preenchedores',
        ativo: true
      },
      {
        nome: 'Galderma',
        cnpj: '00.000.000/0001-01',
        contato: 'Vendas',
        telefone: '(11) 0000-0001',
        email: 'vendas@galderma.com',
        especialidade: 'Dermatologia estética',
        ativo: true
      },
      {
        nome: 'Merz',
        cnpj: '00.000.000/0001-02',
        contato: 'Comercial',
        telefone: '(11) 0000-0002',
        email: 'comercial@merz.com',
        especialidade: 'Estética e bioestimuladores',
        ativo: true
      },
      {
        nome: 'Farmácia de Manipulação',
        cnpj: '00.000.000/0001-03',
        contato: 'Atendimento',
        telefone: '(11) 0000-0003',
        email: 'pedidos@farmacia.com',
        especialidade: 'Manipulados e vitaminas',
        ativo: true
      },
      {
        nome: 'Distribuidora Médica',
        cnpj: '00.000.000/0001-04',
        contato: 'Vendas',
        telefone: '(11) 0000-0004',
        email: 'vendas@distribuidora.com',
        especialidade: 'Materiais descartáveis e equipamentos',
        ativo: true
      }
    ]

    const results = []
    for (const forn of fornecedores) {
      try {
        const result = await estoqueDataService.createFornecedor(forn)
        results.push(result)
      } catch (err) {
        console.error(`Erro ao criar fornecedor ${forn.nome}:`, err)
      }
    }

    return results
  }

  const popularEstoques = async () => {
    const estoques = [
      {
        nome: 'Almoxarifado Central',
        tipo: 'Almoxarifado Central',
        localizacao: 'Andar 1 - Sala 101',
        temperatura_controlada: false,
        responsavel: 'Equipe Administrativa',
        descricao: 'Estoque principal da clínica',
        ativo: true
      },
      {
        nome: 'Sala de Procedimentos 1',
        tipo: 'Sala de Procedimentos',
        localizacao: 'Andar 2 - Sala 201',
        temperatura_controlada: false,
        responsavel: 'Enfermagem',
        descricao: 'Materiais de uso imediato',
        ativo: true
      },
      {
        nome: 'Geladeira Medicamentos',
        tipo: 'Geladeira',
        localizacao: 'Andar 1 - Sala de Enfermagem',
        temperatura_controlada: true,
        temperatura_min: 2,
        temperatura_max: 8,
        responsavel: 'Enfermagem',
        descricao: 'Medicamentos que necessitam refrigeração',
        ativo: true
      },
      {
        nome: 'Estoque para Venda',
        tipo: 'Estoque para Venda',
        localizacao: 'Recepção',
        temperatura_controlada: false,
        responsavel: 'Recepção',
        descricao: 'Produtos para venda direta aos pacientes',
        ativo: true
      }
    ]

    const results = []
    for (const est of estoques) {
      try {
        const result = await estoqueDataService.createEstoque(est)
        results.push(result)
      } catch (err) {
        console.error(`Erro ao criar estoque ${est.nome}:`, err)
      }
    }

    return results
  }

  const popularTodosDados = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(false)

      console.log('🚀 Iniciando população de dados...')

      // Popular categorias
      console.log('📦 Criando categorias...')
      const categorias = await popularCategorias()
      console.log(`✅ ${categorias.length} categorias criadas`)

      // Popular fornecedores
      console.log('🏢 Criando fornecedores...')
      const fornecedores = await popularFornecedores()
      console.log(`✅ ${fornecedores.length} fornecedores criados`)

      // Popular estoques
      console.log('📍 Criando localizações de estoque...')
      const estoques = await popularEstoques()
      console.log(`✅ ${estoques.length} localizações criadas`)

      console.log('🎉 População de dados concluída com sucesso!')

      setSuccess(true)
      return {
        success: true,
        message: 'Dados iniciais criados com sucesso!',
        stats: {
          categorias: categorias.length,
          fornecedores: fornecedores.length,
          estoques: estoques.length
        }
      }
    } catch (err) {
      console.error('❌ Erro ao popular dados:', err)
      setError(err.message)
      return {
        success: false,
        message: `Erro ao criar dados: ${err.message}`
      }
    } finally {
      setLoading(false)
    }
  }

  return {
    popularTodosDados,
    popularCategorias,
    popularFornecedores,
    popularEstoques,
    loading,
    error,
    success
  }
}
