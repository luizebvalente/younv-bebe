/**
 * Dados iniciais para o módulo de estoque
 * Execute este script para popular o banco com categorias e dados básicos
 */

export const categoriasIniciais = [
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

export const fornecedoresIniciais = [
  {
    nome: 'Allergan',
    cnpj: '00.000.000/0001-00',
    contato: 'contato@allergan.com',
    telefone: '(11) 0000-0000',
    especialidade: 'Toxinas botulínicas e preenchedores'
  },
  {
    nome: 'Galderma',
    cnpj: '00.000.000/0001-01',
    contato: 'vendas@galderma.com',
    telefone: '(11) 0000-0001',
    especialidade: 'Dermatologia estética'
  },
  {
    nome: 'Merz',
    cnpj: '00.000.000/0001-02',
    contato: 'comercial@merz.com',
    telefone: '(11) 0000-0002',
    especialidade: 'Estética e bioestimuladores'
  },
  {
    nome: 'Farmácia de Manipulação Local',
    cnpj: '00.000.000/0001-03',
    contato: 'pedidos@farmacia.com',
    telefone: '(11) 0000-0003',
    especialidade: 'Manipulados e vitaminas'
  },
  {
    nome: 'Distribuidora Médica',
    cnpj: '00.000.000/0001-04',
    contato: 'vendas@distribuidora.com',
    telefone: '(11) 0000-0004',
    especialidade: 'Materiais descartáveis e equipamentos'
  }
]

export const estoquesIniciais = [
  {
    nome: 'Almoxarifado Central',
    tipo: 'Almoxarifado Central',
    localizacao: 'Andar 1 - Sala 101',
    temperatura_controlada: false,
    responsavel: 'Equipe Administrativa',
    descricao: 'Estoque principal da clínica'
  },
  {
    nome: 'Sala de Procedimentos 1',
    tipo: 'Sala de Procedimentos',
    localizacao: 'Andar 2 - Sala 201',
    temperatura_controlada: false,
    responsavel: 'Enfermagem',
    descricao: 'Materiais de uso imediato'
  },
  {
    nome: 'Geladeira Medicamentos',
    tipo: 'Geladeira',
    localizacao: 'Andar 1 - Sala de Enfermagem',
    temperatura_controlada: true,
    temperatura_min: 2,
    temperatura_max: 8,
    responsavel: 'Enfermagem',
    descricao: 'Medicamentos que necessitam refrigeração'
  },
  {
    nome: 'Estoque para Venda',
    tipo: 'Estoque para Venda',
    localizacao: 'Recepção',
    temperatura_controlada: false,
    responsavel: 'Recepção',
    descricao: 'Produtos para venda direta aos pacientes'
  }
]

/**
 * Função para popular dados iniciais no Firestore
 */
export async function popularDadosIniciais(estoqueDataService) {
  try {
    console.log('Iniciando população de dados...')

    // Criar categorias
    console.log('Criando categorias...')
    for (const categoria of categoriasIniciais) {
      await estoqueDataService.createCategoria(categoria)
    }

    // Criar fornecedores
    console.log('Criando fornecedores...')
    for (const fornecedor of fornecedoresIniciais) {
      await estoqueDataService.createFornecedor(fornecedor)
    }

    // Criar estoques
    console.log('Criando localizações de estoque...')
    for (const estoque of estoquesIniciais) {
      await estoqueDataService.createEstoque(estoque)
    }

    console.log('Dados iniciais populados com sucesso!')
    return true
  } catch (error) {
    console.error('Erro ao popular dados iniciais:', error)
    return false
  }
}
