import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  MapPin, 
  Package, 
  Search,
  RefreshCw,
  AlertCircle,
  Thermometer,
  Settings
} from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'
import TransferenciaEstoque from './TransferenciaEstoque'
import ConfigurarEstoqueMinimoLocal from './ConfigurarEstoqueMinimoLocal'
import AlertasEstoquePorLocal from './AlertasEstoquePorLocal'

export default function MapaEstoqueTab() {
  const [estoques, setEstoques] = useState([])
  const [produtos, setProdutos] = useState([])
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [estoqueFilter, setEstoqueFilter] = useState('todos')
  const [mapaEstoque, setMapaEstoque] = useState([])
  const [activeTab, setActiveTab] = useState('mapa')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [estoquesData, produtosData, lotesData] = await Promise.all([
        estoqueDataService.getEstoques(),
        estoqueDataService.getProdutos(),
        estoqueDataService.getLotes()
      ])

      setEstoques(estoquesData)
      setProdutos(produtosData)
      setLotes(lotesData)

      construirMapaEstoque(estoquesData, produtosData, lotesData)

      console.log('✅ Dados carregados:', {
        estoques: estoquesData.length,
        produtos: produtosData.length,
        lotes: lotesData.length
      })
    } catch (err) {
      console.error('❌ Erro ao carregar dados:', err)
      setError('Erro ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const construirMapaEstoque = (estoquesData, produtosData, lotesData) => {
    const mapa = []

    estoquesData.forEach(estoque => {
      const lotesDoEstoque = lotesData.filter(lote => lote.estoque_id === estoque.id)

      const produtosPorEstoque = {}

      lotesDoEstoque.forEach(lote => {
        if (!produtosPorEstoque[lote.produto_id]) {
          const produto = produtosData.find(p => p.id === lote.produto_id)
          if (produto) {
            produtosPorEstoque[lote.produto_id] = {
              produto_id: lote.produto_id,
              produto_nome: produto.nome_comercial,
              produto_categoria: produto.categoria,
              unidade_medida: produto.unidade_medida,
              quantidade_total: 0,
              lotes: []
            }
          }
        }

        if (produtosPorEstoque[lote.produto_id]) {
          produtosPorEstoque[lote.produto_id].quantidade_total += (lote.quantidade_atual || 0)
          produtosPorEstoque[lote.produto_id].lotes.push(lote)
        }
      })

      Object.values(produtosPorEstoque).forEach(item => {
        mapa.push({
          estoque_id: estoque.id,
          estoque_nome: estoque.nome,
          estoque_tipo: estoque.tipo,
          temperatura_controlada: estoque.temperatura_controlada,
          temperatura_min: estoque.temperatura_min,
          temperatura_max: estoque.temperatura_max,
          ...item
        })
      })
    })

    setMapaEstoque(mapa)
  }

  const mapaFiltrado = mapaEstoque.filter(item => {
    const matchesSearch = 
      item.produto_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.estoque_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.produto_categoria?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesEstoque = estoqueFilter === 'todos' || item.estoque_id === estoqueFilter

    return matchesSearch && matchesEstoque
  })

  const stats = {
    total_localizacoes: estoques.length,
    localizacoes_ativas: estoques.filter(e => e.ativo).length,
    total_produtos_armazenados: new Set(mapaEstoque.map(m => m.produto_id)).size,
    localizacoes_temperatura_controlada: estoques.filter(e => e.temperatura_controlada).length
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('pt-BR')
    } catch {
      return '-'
    }
  }

  const getValidadeStatus = (dataValidade) => {
    if (!dataValidade) return { label: 'Sem validade', color: 'bg-gray-100 text-gray-800' }

    const hoje = new Date()
    const validade = new Date(dataValidade)
    const diffTime = validade - hoje
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { label: 'Vencido', color: 'bg-red-100 text-red-800' }
    } else if (diffDays <= 30) {
      return { label: `${diffDays} dias`, color: 'bg-red-100 text-red-800' }
    } else if (diffDays <= 60) {
      return { label: `${diffDays} dias`, color: 'bg-yellow-100 text-yellow-800' }
    } else if (diffDays <= 90) {
      return { label: `${diffDays} dias`, color: 'bg-orange-100 text-orange-800' }
    } else {
      return { label: `${diffDays} dias`, color: 'bg-green-100 text-green-800' }
    }
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
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Header com Botões */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mapa de Estoque por Localização</h2>
          <p className="text-sm text-gray-600 mt-1">
            Visualize e gerencie o estoque em cada localização
          </p>
        </div>
        <div className="flex gap-2">
          <ConfigurarEstoqueMinimoLocal />
          <TransferenciaEstoque 
            estoques={estoques}
            produtos={produtos}
            lotes={lotes}
            onSuccess={loadData}
          />
        </div>
      </div>

      {/* Tabs Principal */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mapa" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Mapa de Estoque
          </TabsTrigger>
          <TabsTrigger value="alertas" className="flex items-center gap-2 bg-gradient-to-r from-red-50 to-orange-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-red-700 font-semibold">Alertas por Local</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB: MAPA DE ESTOQUE */}
        <TabsContent value="mapa" className="space-y-6">
          {/* Estatísticas */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total de Localizações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_localizacoes}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.localizacoes_ativas} ativas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">
                  Produtos Armazenados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.total_produtos_armazenados}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Diferentes produtos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-600">
                  Temperatura Controlada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.localizacoes_temperatura_controlada}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Localizações refrigeradas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">
                  Itens no Mapa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {mapaFiltrado.length}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Produtos × Localizações
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Distribuição de Produtos por Localização
                </CardTitle>
                <Button onClick={loadData} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar produtos ou localizações..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={estoqueFilter} onValueChange={setEstoqueFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as localizações</SelectItem>
                    {estoques.map((estoque) => (
                      <SelectItem key={estoque.id} value={estoque.id}>
                        {estoque.nome} - {estoque.tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tabela do Mapa */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Localização</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead>Lotes</TableHead>
                      <TableHead>Validade Próxima</TableHead>
                      <TableHead>Temperatura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mapaFiltrado.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                          <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="font-medium">Nenhum item encontrado</p>
                          <p className="text-sm mt-1">
                            {mapaEstoque.length === 0 
                              ? 'Não há produtos armazenados nas localizações'
                              : 'Tente ajustar os filtros de busca'}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      mapaFiltrado.map((item, index) => {
                        const lotesComValidade = item.lotes.filter(l => l.data_validade)
                        const loteProximoVencimento = lotesComValidade.length > 0
                          ? lotesComValidade.reduce((prev, current) => {
                              return new Date(prev.data_validade) < new Date(current.data_validade) ? prev : current
                            })
                          : null

                        const validadeStatus = loteProximoVencimento 
                          ? getValidadeStatus(loteProximoVencimento.data_validade)
                          : { label: 'N/A', color: 'bg-gray-100 text-gray-800' }

                        return (
                          <TableRow key={`${item.estoque_id}-${item.produto_id}-${index}`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-blue-600" />
                                {item.estoque_nome}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.estoque_tipo}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-green-600" />
                                <span className="font-medium">{item.produto_nome}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.produto_categoria}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {item.quantidade_total} {item.unidade_medida}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-gray-100 text-gray-800">
                                {item.lotes.length} lote(s)
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {loteProximoVencimento ? (
                                <div>
                                  <Badge className={validadeStatus.color}>
                                    {validadeStatus.label}
                                  </Badge>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {formatDate(loteProximoVencimento.data_validade)}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">Sem validade</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.temperatura_controlada ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Thermometer className="h-4 w-4 text-blue-600" />
                                  <span className="text-blue-600 font-medium">
                                    {item.temperatura_min}°C a {item.temperatura_max}°C
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">Ambiente</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Resumo */}
              {mapaFiltrado.length > 0 && (
                <div className="mt-4 text-sm text-gray-600">
                  Mostrando {mapaFiltrado.length} de {mapaEstoque.length} itens no mapa de estoque
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cards de Resumo por Localização */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {estoques.map(estoque => {
              const itensDoEstoque = mapaEstoque.filter(m => m.estoque_id === estoque.id)
              const quantidadeTotal = itensDoEstoque.reduce((sum, item) => sum + item.quantidade_total, 0)
              const produtosUnicos = new Set(itensDoEstoque.map(m => m.produto_id)).size

              return (
                <Card key={estoque.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      {estoque.nome}
                    </CardTitle>
                    <p className="text-xs text-gray-500">{estoque.tipo}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Produtos diferentes:</span>
                        <span className="font-semibold">{produtosUnicos}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total de itens:</span>
                        <span className="font-semibold">{itensDoEstoque.length}</span>
                      </div>
                      {estoque.temperatura_controlada && (
                        <div className="flex items-center gap-1 text-blue-600 pt-2 border-t">
                          <Thermometer className="h-4 w-4" />
                          <span className="text-xs font-medium">
                            {estoque.temperatura_min}°C a {estoque.temperatura_max}°C
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* TAB: ALERTAS POR LOCAL */}
        <TabsContent value="alertas">
          <AlertasEstoquePorLocal />
        </TabsContent>
      </Tabs>
    </div>
  )
}
