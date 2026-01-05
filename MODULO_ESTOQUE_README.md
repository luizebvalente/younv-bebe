# Módulo de Estoque - Younv Clinical CRM

## 📦 Visão Geral

O módulo de estoque foi desenvolvido especificamente para clínicas médicas e estéticas, oferecendo controle completo sobre produtos, lotes, validades, múltiplos estoques e kits de procedimentos.

## ✨ Funcionalidades Implementadas

### 1. Cadastro Detalhado de Produtos

- **Nome comercial** - Nome pelo qual o produto é conhecido
- **Nome técnico / princípio ativo** - Composição técnica do produto
- **Categoria** - Classificação (injeção, soroterapia, dermatologia, nutrição, kits, descartáveis, etc.)
- **Fornecedor vinculado** - Relacionamento com fornecedores cadastrados
- **Unidade de medida** - Ampola, frasco, caixa, mL, mg, etc.
- **Volume por unidade** - Ex: 10mL por ampola
- **Localização no estoque** - Prateleira, geladeira, sala de procedimentos
- **Estoque mínimo e máximo** - Para controle de reposição
- **Valor unitário** - Custo do produto
- **Status ativo/inativo** - Controle de produtos em uso

### 2. Controle de Lotes e Validade

- **Registro automático de lotes** com número, data de fabricação e validade
- **Sistema de alertas inteligentes** para produtos que vão vencer em:
  - 90 dias (alerta baixa prioridade)
  - 60 dias (alerta média prioridade)
  - 30 dias (alerta alta prioridade)
- **Bloqueio visual** de itens vencidos
- **Suporte a FIFO e FEFO** - Utilizar primeiro o mais antigo ou o que vence primeiro
- **Rastreabilidade completa** - Nota fiscal, fornecedor do lote, valor de compra

### 3. Múltiplos Estoques

O sistema suporta diferentes localizações de estoque:

- **Almoxarifado central** - Estoque principal
- **Sala de procedimentos** - Materiais de uso imediato
- **Sala de enfermagem** - Medicamentos e materiais de enfermagem
- **Geladeiras específicas** - Com controle de temperatura (2°C a 8°C)
- **Freezers** - Para produtos que necessitam congelamento
- **Estoque manipulado** - Para uso interno
- **Estoque para venda** - Produtos retail (skin care, vitaminas, colágeno)
- **Armários de medicamentos** - Organização por tipo

Cada localização pode ter:
- Controle de temperatura (mínima e máxima)
- Responsável designado
- Localização física detalhada
- Status ativo/inativo

### 4. Sistema de Kits e Protocolos

Permite montar e gerenciar kits completos como:

- **Protocolo de soroterapia detox**
- **Protocolo imunidade**
- **Protocolo vitamina D**
- **Protocolo de PRP**
- **Kit de botox** (agulha, seringa, diluente, toxina)
- **Kit de implante hormonal**

**Funcionalidades dos Kits:**
- Criar kits com múltiplos produtos e quantidades
- Verificação automática de disponibilidade em tempo real
- Baixa automática do kit inteiro (todos os itens de uma vez)
- Rastreamento de uso de kits
- Categorização por tipo de protocolo

### 5. Alertas Inteligentes

O sistema gera automaticamente alertas para:

- **Estoque mínimo atingido** - Quando o produto atinge o estoque mínimo configurado
- **Estoque zerado** - Alerta de alta prioridade
- **Produto prestes a vencer** - Alertas em 90, 60 e 30 dias
- **Produtos sem movimentação** - Identificação de produtos encalhados
- **Diferença entre estoque físico x sistema** - Para inventário

**Sistema de Prioridades:**
- 🔴 **Alta** - Requer ação imediata (estoque zerado, vencimento em 30 dias)
- 🟡 **Média** - Requer atenção (estoque mínimo, vencimento em 60 dias)
- 🔵 **Baixa** - Informativo (vencimento em 90 dias)

### 6. Dashboard e Estatísticas

- Total de produtos cadastrados e ativos
- Total de lotes e lotes ativos
- Movimentações do dia (entradas e saídas)
- Valor total em estoque
- Resumo de alertas por prioridade
- Produtos em estoque mínimo
- Produtos próximos ao vencimento

## 🗂️ Estrutura de Arquivos

```
src/
├── components/
│   └── pages/
│       └── estoque/
│           ├── Estoque.jsx                    # Página principal com tabs
│           ├── DashboardEstoque.jsx           # Dashboard de estatísticas
│           └── tabs/
│               ├── ProdutosTab.jsx            # Gestão de produtos
│               ├── LotesTab.jsx               # Gestão de lotes
│               ├── EstoquesTab.jsx            # Gestão de localizações
│               ├── KitsTab.jsx                # Gestão de kits
│               └── AlertasTab.jsx             # Visualização de alertas
├── services/
│   └── estoque/
│       ├── estoqueDataService.js              # Serviço de dados principal
│       └── seedData.js                        # Dados iniciais
└── hooks/
    └── estoque/
        ├── useEstoqueAlertas.js               # Hook para alertas
        └── useEstoqueProdutos.js              # Hook para produtos
```

## 🔧 Collections do Firestore

O módulo utiliza as seguintes collections no Firestore:

1. **produtos** - Cadastro de produtos
2. **lotes** - Lotes de produtos com validade
3. **estoques** - Localizações de estoque
4. **movimentacoes_estoque** - Histórico de movimentações
5. **kits** - Kits e protocolos
6. **kits_itens** - Itens que compõem cada kit
7. **fornecedores** - Cadastro de fornecedores
8. **categorias_produtos** - Categorias de produtos
9. **alertas_estoque** - Alertas do sistema

## 🚀 Como Usar

### Acessar o Módulo

1. Faça login no sistema
2. No menu lateral, clique em **Estoque**
3. Você verá 6 abas principais:
   - Dashboard
   - Produtos
   - Lotes
   - Localizações
   - Kits
   - Alertas

### Cadastrar um Produto

1. Acesse a aba **Produtos**
2. Clique em **Novo Produto**
3. Preencha os campos obrigatórios:
   - Nome comercial
   - Categoria
   - Unidade de medida
4. Preencha os campos opcionais conforme necessário
5. Clique em **Salvar**

### Registrar um Lote

1. Acesse a aba **Lotes**
2. Clique em **Novo Lote**
3. Selecione o produto
4. Informe:
   - Número do lote
   - Quantidade inicial
   - Data de validade
5. Opcionalmente informe:
   - Data de fabricação
   - Localização
   - Fornecedor
   - Nota fiscal
   - Valor de compra
6. Clique em **Salvar**

### Criar um Kit

1. Acesse a aba **Kits**
2. Clique em **Novo Kit**
3. Informe nome, categoria e descrição
4. Clique em **Salvar**
5. Clique no ícone de lista para adicionar itens ao kit
6. Selecione produtos e quantidades
7. Clique em **Adicionar**

### Baixar um Kit do Estoque

1. Acesse a aba **Kits**
2. Localize o kit desejado
3. Clique no ícone de **Baixar Kit** (círculo com sinal de menos)
4. Confirme a operação
5. O sistema automaticamente dará baixa em todos os itens do kit

### Gerenciar Alertas

1. Acesse a aba **Alertas**
2. Clique em **Gerar Alertas** para atualizar os alertas
3. Visualize alertas por prioridade
4. Marque alertas como visualizados clicando no ícone de olho
5. Exclua alertas resolvidos clicando no ícone de lixeira

## 📊 Dados Iniciais

O sistema vem com dados pré-configurados:

### Categorias
- Injeção
- Soroterapia
- Dermatologia
- Nutrição
- Kits
- Descartáveis
- Botox e Toxinas
- Preenchimento
- Bioestimuladores
- Vitaminas
- Hormônios
- Antioxidantes
- Skin Care
- Hair Care
- Equipamentos

### Fornecedores Exemplo
- Allergan
- Galderma
- Merz
- Farmácia de Manipulação Local
- Distribuidora Médica

### Localizações Padrão
- Almoxarifado Central
- Sala de Procedimentos 1
- Geladeira Medicamentos (2°C a 8°C)
- Estoque para Venda

## 🔐 Segurança e Permissões

- Todas as operações são autenticadas via Firebase Authentication
- Apenas usuários logados podem acessar o módulo
- Histórico completo de movimentações com usuário e data/hora
- Rastreabilidade de todas as operações

## 🎨 Interface

- Design moderno e responsivo usando Tailwind CSS
- Componentes reutilizáveis do shadcn/ui
- Ícones do Lucide React
- Experiência mobile-first
- Feedback visual para todas as ações
- Loading states e tratamento de erros

## 📈 Próximas Melhorias Sugeridas

1. **Relatórios Avançados**
   - Relatório de consumo por período
   - Análise de curva ABC
   - Previsão de reposição

2. **Integração com Procedimentos**
   - Consumo automático de produtos ao realizar procedimento
   - Sugestão de produtos por procedimento

3. **Inventário**
   - Funcionalidade de contagem física
   - Ajuste de estoque
   - Relatório de divergências

4. **Código de Barras**
   - Leitura de código de barras
   - Impressão de etiquetas

5. **Notificações**
   - Notificações push para alertas críticos
   - E-mail para responsáveis

6. **Pedidos de Compra**
   - Geração automática de pedidos
   - Controle de orçamentos
   - Histórico de compras

## 🐛 Troubleshooting

### Alertas não aparecem
- Clique em "Gerar Alertas" na aba de Alertas
- Verifique se há produtos com estoque mínimo configurado
- Verifique se há lotes próximos ao vencimento

### Kit não pode ser baixado
- Verifique se todos os produtos do kit têm estoque suficiente
- Acesse a aba de Produtos para conferir o estoque atual

### Dados iniciais não aparecem
- Execute o script de seed data (seedData.js)
- Verifique a conexão com o Firestore

## 📝 Licença

Este módulo faz parte do sistema Younv Clinical CRM.

## 👥 Suporte

Para dúvidas ou sugestões sobre o módulo de estoque, entre em contato com a equipe de desenvolvimento.

---

**Versão:** 1.0.0  
**Data de Criação:** Novembro 2025  
**Branch:** feature/modulo-estoque
