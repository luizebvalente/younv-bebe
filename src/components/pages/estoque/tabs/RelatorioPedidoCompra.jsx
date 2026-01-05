import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ShoppingCart,
  Download,
  Printer,
  AlertTriangle,
  Package,
  MapPin,
  Building2,
  TrendingDown,
  FileText,
  RefreshCw,
  CheckCircle
} from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'
import estoqueMinimoPorLocalService from '@/services/estoque/estoqueMinimoPorLocal'

export default function RelatorioPedidoCompra() {
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [estoques, setEstoques] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('geral')
  
  // Análises
  const [pedidoGeral, setPedidoGeral] = useState([])
  const [pedidoPorLocal, setPedidoPorLocal] = useState([])
  
  // Filtros
  const [categoriaFilter, setCategoriaFilter] = useState('todas')
  const [fornecedorFilter, setFornecedorFilter] = useState('todos')
  const [localFilter, setLocalFilter] = useState('todos')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const [produtosData, categoriasData, fornecedoresData, estoquesData] = await Promise.all([
        estoqueDataService.getProdutos(),
        estoqueDataService.getCategorias(),
        estoqueDataService.getFornecedores(),
        estoqueDataService.getEstoques()
      ])

      setProdutos(produtosData)
      setCategorias(categoriasData)
      setFornecedores(fornecedoresData)
      setEstoques(estoquesData)

      // Gerar análises
      await gerarPedidoGeral(produtosData)
      await gerarPedidoPorLocal(produtosData, estoquesData)
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * 📦 PEDIDO GERAL - Produtos abaixo do estoque mínimo cadastrado no produto
   */
  const gerarPedidoGeral = async (produtosData) => {
    console.log('📊 Gerando pedido de compra geral...')
    
    const pedido = []

    for (const produto of produtosData) {
      const estoqueAtual = produto.estoque_atual || 0
      const estoqueMinimo = produto.estoque_minimo || 0
      const estoqueMaximo = produto.estoque_maximo || 0

      // Verificar se está abaixo do mínimo
      if (estoqueMinimo > 0 && estoqueAtual < estoqueMinimo) {
        const deficit = estoqueMinimo - estoqueAtual
        const quantidadeSugerida = estoqueMaximo > 0 
          ? estoqueMaximo - estoqueAtual 
          : deficit

        const prioridade = estoqueAtual === 0 ? 'alta' : 
                          estoqueAtual < (estoqueMinimo / 2) ? 'alta' : 
                          'media'

        pedido.push({
          produto_id: produto.id,
          produto_nome: produto.nome_comercial,
          categoria: produto.categoria,
          fornecedor_id: produto.fornecedor_id,
          unidade_medida: produto.unidade_medida,
          estoque_atual: estoqueAtual,
          estoque_minimo: estoqueMinimo,
          estoque_maximo: estoqueMaximo,
          deficit: deficit,
          quantidade_sugerida: quantidadeSugerida,
          valor_unitario: produto.valor_unitario || 0,
          valor_total: quantidadeSugerida * (produto.valor_unitario || 0),
          prioridade: prioridade,
          percentual_falta: ((deficit / estoqueMinimo) * 100).toFixed(1)
        })
      }
    }

    // Ordenar por prioridade e deficit
    pedido.sort((a, b) => {
      if (a.prioridade === 'alta' && b.prioridade !== 'alta') return -1
      if (a.prioridade !== 'alta' && b.prioridade === 'alta') return 1
      return b.deficit - a.deficit
    })

    console.log(`✅ Pedido geral gerado: ${pedido.length} itens`)
    setPedidoGeral(pedido)
    return pedido
  }

  /**
   * 🏪 PEDIDO POR LOCAL - Produtos abaixo do mínimo em cada localização
   */
  const gerarPedidoPorLocal = async (produtosData, estoquesData) => {
    console.log('🏪 Gerando pedido de compra por localização...')
    
    try {
      // Buscar análise de estoque baixo por local
      const analise = await estoqueMinimoPorLocalService.analisarEstoqueBaixo(estoqueDataService)
      
      const pedido = analise.alertas.map(alerta => {
        const produto = produtosData.find(p => p.id === alerta.produto_id)
        
        return {
          produto_id: alerta.produto_id,
          produto_nome: alerta.produto_nome,
          categoria: produto?.categoria || '',
          fornecedor_id: produto?.fornecedor_id || '',
          unidade_medida: produto?.unidade_medida || '',
          estoque_id: alerta.estoque_id,
          estoque_nome: alerta.estoque_nome,
          estoque_tipo: alerta.estoque_tipo,
          quantidade_atual: alerta.quantidade_atual,
          quantidade_minima: alerta.quantidade_minima,
          quantidade_ideal: alerta.quantidade_ideal,
          deficit: alerta.deficit,
          quantidade_sugerida: alerta.quantidade_ideal - alerta.quantidade_atual,
          valor_unitario: produto?.valor_unitario || 0,
          valor_total: (alerta.quantidade_ideal - alerta.quantidade_atual) * (produto?.valor_unitario || 0),
          prioridade: alerta.prioridade,
          percentual_falta: alerta.percentual_falta,
          pode_transferir: alerta.pode_transferir,
          sugestao_transferencia: alerta.sugestao_transferencia
        }
      })

      console.log(`✅ Pedido por local gerado: ${pedido.length} itens`)
      setPedidoPorLocal(pedido)
      return pedido
      
    } catch (error) {
      console.error('❌ Erro ao gerar pedido por local:', error)
      setPedidoPorLocal([])
      return []
    }
  }

  // Filtros
  const pedidoGeralFiltrado = pedidoGeral.filter(item => {
    const matchCategoria = categoriaFilter === 'todas' || item.categoria === categoriaFilter
    const matchFornecedor = fornecedorFilter === 'todos' || item.fornecedor_id === fornecedorFilter
    return matchCategoria && matchFornecedor
  })

  const pedidoPorLocalFiltrado = pedidoPorLocal.filter(item => {
    const matchCategoria = categoriaFilter === 'todas' || item.categoria === categoriaFilter
    const matchFornecedor = fornecedorFilter === 'todos' || item.fornecedor_id === fornecedorFilter
    const matchLocal = localFilter === 'todos' || item.estoque_id === localFilter
    return matchCategoria && matchFornecedor && matchLocal
  })

  // Estatísticas
  const statsGeral = {
    total_itens: pedidoGeralFiltrado.length,
    alta_prioridade: pedidoGeralFiltrado.filter(i => i.prioridade === 'alta').length,
    valor_total: pedidoGeralFiltrado.reduce((sum, i) => sum + i.valor_total, 0),
    quantidade_total: pedidoGeralFiltrado.reduce((sum, i) => sum + i.quantidade_sugerida, 0)
  }

  const statsPorLocal = {
    total_itens: pedidoPorLocalFiltrado.length,
    alta_prioridade: pedidoPorLocalFiltrado.filter(i => i.prioridade === 'alta').length,
    valor_total: pedidoPorLocalFiltrado.reduce((sum, i) => sum + i.valor_total, 0),
    quantidade_total: pedidoPorLocalFiltrado.reduce((sum, i) => sum + i.quantidade_sugerida, 0),
    locais_afetados: new Set(pedidoPorLocalFiltrado.map(i => i.estoque_id)).size,
    com_transferencia: pedidoPorLocalFiltrado.filter(i => i.pode_transferir).length
  }

  const getFornecedorNome = (id) => {
    const fornecedor = fornecedores.find(f => f.id === id)
    return fornecedor ? fornecedor.nome : 'N/A'
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const getPrioridadeColor = (prioridade) => {
    switch (prioridade) {
      case 'alta':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'media':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300'
    }
  }

  const getPrioridadeIcon = (prioridade) => {
    switch (prioridade) {
      case 'alta':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'media':
        return <TrendingDown className="h-4 w-4 text-yellow-600" />
      default:
        return <TrendingDown className="h-4 w-4 text-blue-600" />
    }
  }

  /**
   * 📄 Exportar para CSV
   */
  const exportarCSV = (tipo = 'geral') => {
    const dados = tipo === 'geral' ? pedidoGeralFiltrado : pedidoPorLocalFiltrado
    
    let headers = []
    let rows = []

    if (tipo === 'geral') {
      headers = [
        'Prioridade',
        'Produto',
        'Categoria',
        'Fornecedor',
        'Unidade',
        'Estoque Atual',
        'Estoque Mínimo',
        'Estoque Máximo',
        'Déficit',
        'Quantidade Sugerida',
        'Valor Unitário',
        'Valor Total'
      ]

      rows = dados.map(item => [
        item.prioridade.toUpperCase(),
        item.produto_nome,
        item.categoria,
        getFornecedorNome(item.fornecedor_id),
        item.unidade_medida,
        item.estoque_atual,
        item.estoque_minimo,
        item.estoque_maximo,
        item.deficit,
        item.quantidade_sugerida,
        item.valor_unitario,
        item.valor_total
      ])
    } else {
      headers = [
        'Prioridade',
        'Produto',
        'Categoria',
        'Fornecedor',
        'Localização',
        'Tipo Local',
        'Qtd Atual',
        'Qtd Mínima',
        'Qtd Ideal',
        'Déficit',
        'Qtd Sugerida',
        'Pode Transferir',
        'Valor Unitário',
        'Valor Total'
      ]

      rows = dados.map(item => [
        item.prioridade.toUpperCase(),
        item.produto_nome,
        item.categoria,
        getFornecedorNome(item.fornecedor_id),
        item.estoque_nome,
        item.estoque_tipo,
        item.quantidade_atual,
        item.quantidade_minima,
        item.quantidade_ideal,
        item.deficit,
        item.quantidade_sugerida,
        item.pode_transferir ? 'SIM' : 'NÃO',
        item.valor_unitario,
        item.valor_total
      ])
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `pedido_compra_${tipo}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /**
   * 🖨️ Imprimir relatório
   */
  const imprimirRelatorio = (tipo = 'geral') => {
    const dados = tipo === 'geral' ? pedidoGeralFiltrado : pedidoPorLocalFiltrado
    const stats = tipo === 'geral' ? statsGeral : statsPorLocal
    
    const printWindow = window.open('', '_blank')
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pedido de Compra - ${tipo === 'geral' ? 'Geral' : 'Por Localização'}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
          }
          .stat-box {
            border: 1px solid #ddd;
            padding: 15px;
            border-radius: 5px;
            background: #f9f9f9;
          }
          .stat-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
          }
          .stat-value {
            font-size: 20px;
            font-weight: bold;
            color: #333;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 11px;
          }
          th {
            background: #f0f0f0;
            padding: 10px 5px;
            text-align: left;
            border: 1px solid #ddd;
            font-weight: bold;
          }
          td {
            padding: 8px 5px;
            border: 1px solid #ddd;
          }
          .prioridade-alta {
            background: #fee;
            color: #c00;
            font-weight: bold;
          }
          .prioridade-media {
            background: #fff5e6;
            color: #f90;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #666;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 Pedido de Compra</h1>
          <h2>${tipo === 'geral' ? 'Reposição Geral de Estoque' : 'Reposição por Localização'}</h2>
          <p>Data: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>

        <div class="stats">
          <div class="stat-box">
            <div class="stat-label">Total de Itens</div>
            <div class="stat-value">${stats.total_itens}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Alta Prioridade</div>
            <div class="stat-value" style="color: #c00;">${stats.alta_prioridade}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Valor Total</div>
            <div class="stat-value">${formatCurrency(stats.valor_total)}</div>
          </div>
          ${tipo === 'local' ? `
          <div class="stat-box">
            <div class="stat-label">Locais Afetados</div>
            <div class="stat-value">${statsPorLocal.locais_afetados}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Podem Transferir</div>
            <div class="stat-value" style="color: #090;">${statsPorLocal.com_transferencia}</div>
          </div>
          ` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Pri.</th>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Fornecedor</th>
              ${tipo === 'local' ? '<th>Localização</th>' : ''}
              <th>Atual</th>
              <th>Mínimo</th>
              <th>Sugerido</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${dados.map(item => `
              <tr class="${item.prioridade === 'alta' ? 'prioridade-alta' : item.prioridade === 'media' ? 'prioridade-media' : ''}">
                <td>${item.prioridade === 'alta' ? '🔴' : item.prioridade === 'media' ? '🟡' : '🔵'}</td>
                <td><strong>${item.produto_nome}</strong></td>
                <td>${item.categoria}</td>
                <td>${getFornecedorNome(item.fornecedor_id)}</td>
                ${tipo === 'local' ? `<td>${item.estoque_nome}</td>` : ''}
                <td>${item.quantidade_atual || item.estoque_atual}</td>
                <td>${item.quantidade_minima || item.estoque_minimo}</td>
                <td><strong>${item.quantidade_sugerida}</strong> ${item.unidade_medida}</td>
                <td>${formatCurrency(item.valor_total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>📄 Relatório gerado automaticamente pelo Sistema de Gestão de Estoque</p>
          <p>⚠️ Conferir disponibilidade com fornecedores antes de efetuar pedidos</p>
        </div>
      </body>
      </html>
    `
    
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            Pedido de Compra
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Produtos que necessitam reposição de estoque
          </p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="geral" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Pedido Geral
            {statsGeral.total_itens > 0 && (
              <Badge className="ml-2 bg-red-500">{statsGeral.total_itens}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="local" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Por Localização
            {statsPorLocal.total_itens > 0 && (
              <Badge className="ml-2 bg-orange-500">{statsPorLocal.total_itens}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB: PEDIDO GERAL */}
        <TabsContent value="geral" className="space-y-6">
          {/* Estatísticas */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total de Itens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsGeral.total_itens}</div>
                <p className="text-xs text-gray-500 mt-1">
                  Produtos abaixo do mínimo
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600">
                  Alta Prioridade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {statsGeral.alta_prioridade}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Requerem ação imediata
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">
                  Valor Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(statsGeral.valor_total)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Investimento necessário
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">
                  Quantidade Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {statsGeral.quantidade_total}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Unidades a comprar
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Lista de Compras - Estoque Geral
                </CardTitle>
                <div className="flex gap-2">
                  <Button onClick={() => exportarCSV('geral')} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                  <Button onClick={() => imprimirRelatorio('geral')} variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as categorias</SelectItem>
                      {categorias.map(cat => (
                        <SelectItem key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Fornecedor</Label>
                  <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os fornecedores</SelectItem>
                      {fornecedores.map(forn => (
                        <SelectItem key={forn.id} value={forn.id}>
                          {forn.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabela */}
              {pedidoGeralFiltrado.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-900">
                    ✅ Estoque em ordem!
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Todos os produtos estão acima do estoque mínimo.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Atual</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                        <TableHead className="text-right">Máximo</TableHead>
                        <TableHead className="text-right">Déficit</TableHead>
                        <TableHead className="text-right">Qtd. Sugerida</TableHead>
                        <TableHead className="text-right">Valor Unit.</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidoGeralFiltrado.map((item, index) => (
                        <TableRow 
                          key={index}
                          className={`border-l-4 ${
                            item.prioridade === 'alta' ? 'border-l-red-500 bg-red-50' :
                            item.prioridade === 'media' ? 'border-l-yellow-500 bg-yellow-50' :
                            'border-l-blue-500 bg-blue-50'
                          }`}
                        >
                          <TableCell>
                            {getPrioridadeIcon(item.prioridade)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-blue-600" />
                              <div>
                                <p className="font-medium">{item.produto_nome}</p>
                                <p className="text-xs text-gray-500">{item.unidade_medida}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.categoria}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">{getFornecedorNome(item.fornecedor_id)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={
                              item.estoque_atual === 0 ? 'bg-red-100 text-red-800' :
                              item.estoque_atual < item.estoque_minimo / 2 ? 'bg-orange-100 text-orange-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {item.estoque_atual}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.estoque_minimo}
                          </TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            {item.estoque_maximo || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div>
                              <p className="font-bold text-red-600">-{item.deficit}</p>
                              <p className="text-xs text-gray-600">
                                ({item.percentual_falta}%)
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-green-100 text-green-800 font-bold">
                              {item.quantidade_sugerida}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(item.valor_unitario)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {formatCurrency(item.valor_total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: PEDIDO POR LOCALIZAÇÃO */}
        <TabsContent value="local" className="space-y-6">
          {/* Estatísticas */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total de Itens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsPorLocal.total_itens}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600">
                  Alta Prioridade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {statsPorLocal.alta_prioridade}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-600">
                  Locais Afetados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {statsPorLocal.locais_afetados}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">
                  Podem Transferir
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {statsPorLocal.com_transferencia}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">
                  Valor Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(statsPorLocal.valor_total)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-purple-600" />
                  Lista de Compras - Por Localização
                </CardTitle>
                <div className="flex gap-2">
                  <Button onClick={() => exportarCSV('local')} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                  <Button onClick={() => imprimirRelatorio('local')} variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as categorias</SelectItem>
                      {categorias.map(cat => (
                        <SelectItem key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Fornecedor</Label>
                  <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os fornecedores</SelectItem>
                      {fornecedores.map(forn => (
                        <SelectItem key={forn.id} value={forn.id}>
                          {forn.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Localização</Label>
                  <Select value={localFilter} onValueChange={setLocalFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas as localizações</SelectItem>
                      {estoques.map(est => (
                        <SelectItem key={est.id} value={est.id}>
                          {est.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabela */}
              {pedidoPorLocalFiltrado.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-900">
                    ✅ Todas as localizações estão OK!
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Configure o estoque mínimo por local para usar este recurso.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Atual</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                        <TableHead className="text-right">Ideal</TableHead>
                        <TableHead className="text-right">Sugerido</TableHead>
                        <TableHead>Transferência</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidoPorLocalFiltrado.map((item, index) => (
                        <TableRow 
                          key={index}
                          className={`border-l-4 ${
                            item.prioridade === 'alta' ? 'border-l-red-500 bg-red-50' :
                            item.prioridade === 'media' ? 'border-l-yellow-500 bg-yellow-50' :
                            'border-l-blue-500 bg-blue-50'
                          }`}
                        >
                          <TableCell>
                            {getPrioridadeIcon(item.prioridade)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-blue-600" />
                              <div>
                                <p className="font-medium">{item.produto_nome}</p>
                                <p className="text-xs text-gray-500">{item.categoria}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-green-600" />
                              <div>
                                <p className="font-medium">{item.estoque_nome}</p>
                                <p className="text-xs text-gray-500">{item.estoque_tipo}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">{getFornecedorNome(item.fornecedor_id)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={
                              item.quantidade_atual === 0 ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {item.quantidade_atual}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.quantidade_minima}
                          </TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            {item.quantidade_ideal}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-green-100 text-green-800 font-bold">
                              {item.quantidade_sugerida}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.pode_transferir ? (
                              <Badge className="bg-blue-100 text-blue-800">
                                ✓ Possível transferir
                              </Badge>
                            ) : (
                              <Badge className="bg-orange-100 text-orange-800">
                                ✗ Necessário comprar
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {formatCurrency(item.valor_total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Informação sobre configuração */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <p className="font-semibold text-blue-900">💡 Dica</p>
              <p className="text-sm text-blue-700 mt-1">
                Para usar o relatório por localização, configure o estoque mínimo de cada produto 
                em cada local através do botão "Config. Mínimo por Local" na aba Mapa de Estoque.
              </p>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  )
}
