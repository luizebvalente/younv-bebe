import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertTriangle,
  TrendingDown,
  Package,
  MapPin,
  ArrowRightLeft,
  RefreshCw,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Lightbulb
} from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'
import estoqueMinimoPorLocalService from '@/services/estoque/estoqueMinimoPorLocal'
import TransferenciaEstoque from './TransferenciaEstoque'

export default function AlertasEstoquePorLocal() {
  const [analise, setAnalise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [estoques, setEstoques] = useState([])
  const [produtos, setProdutos] = useState([])
  const [lotes, setLotes] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [analiseData, estoquesData, produtosData, lotesData] = await Promise.all([
        estoqueMinimoPorLocalService.analisarEstoqueBaixo(estoqueDataService),
        estoqueDataService.getEstoques(),
        estoqueDataService.getProdutos(),
        estoqueDataService.getLotes()
      ])

      setAnalise(analiseData)
      setEstoques(estoquesData)
      setProdutos(produtosData)
      setLotes(lotesData)

      console.log('✅ Análise carregada:', analiseData)
    } catch (err) {
      console.error('❌ Erro ao carregar análise:', err)
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const getPrioridadeColor = (prioridade) => {
    switch (prioridade) {
      case 'alta':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'media':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'baixa':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total de Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analise?.total_alertas || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              Locais com estoque baixo
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
              {analise?.alertas_alta || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Requerem ação imediata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">
              Média Prioridade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {analise?.alertas_media || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Necessitam atenção
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">
              Baixa Prioridade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {analise?.alertas_baixa || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Acompanhamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Alertas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Alertas de Estoque Baixo por Localização
            </CardTitle>
            <Button onClick={loadData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!analise || analise.alertas.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900">
                ✅ Todos os estoques estão adequados!
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Nenhuma localização está abaixo do estoque mínimo configurado.
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
                    <TableHead className="text-right">Atual</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="text-right">Ideal</TableHead>
                    <TableHead className="text-right">Déficit</TableHead>
                    <TableHead>Sugestão</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analise.alertas.map((alerta, index) => (
                    <TableRow 
                      key={index}
                      className={`border-l-4 ${
                        alerta.prioridade === 'alta' ? 'border-l-red-500 bg-red-50' :
                        alerta.prioridade === 'media' ? 'border-l-yellow-500 bg-yellow-50' :
                        'border-l-blue-500 bg-blue-50'
                      }`}
                    >
                      <TableCell>
                        {getPrioridadeIcon(alerta.prioridade)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          <div>
                            <p className="font-medium">{alerta.produto_nome}</p>
                            <p className="text-xs text-gray-500">ID: {alerta.produto_id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="font-medium">{alerta.estoque_nome}</p>
                            <p className="text-xs text-gray-500">{alerta.estoque_tipo}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={
                          alerta.quantidade_atual === 0 ? 'bg-red-100 text-red-800' :
                          alerta.quantidade_atual < alerta.quantidade_minima / 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }>
                          {alerta.quantidade_atual}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {alerta.quantidade_minima}
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        {alerta.quantidade_ideal}
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p className="font-bold text-red-600">-{alerta.deficit}</p>
                          <p className="text-xs text-gray-600">
                            ({alerta.percentual_falta}%)
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {alerta.sugestao_transferencia.possivel ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Lightbulb className="h-4 w-4 text-yellow-600" />
                              <span className="font-medium text-green-700">
                                Transferir {alerta.sugestao_transferencia.quantidade_sugerida}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <MapPin className="h-3 w-3" />
                              De: {alerta.sugestao_transferencia.origem_nome}
                            </div>
                            <div className="text-xs text-gray-500">
                              Disponível: {alerta.sugestao_transferencia.quantidade_disponivel_origem}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-sm text-red-600">
                            <XCircle className="h-4 w-4" />
                            <div>
                              <p className="font-medium">Sem estoque</p>
                              <p className="text-xs">Necessário comprar</p>
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {alerta.sugestao_transferencia.possivel ? (
                          <TransferenciaEstoque
                            estoques={estoques}
                            produtos={produtos}
                            lotes={lotes}
                            onSuccess={loadData}
                            preenchido={{
                              produto_id: alerta.produto_id,
                              estoque_origem_id: alerta.sugestao_transferencia.origem_id,
                              estoque_destino_id: alerta.estoque_id,
                              quantidade: alerta.sugestao_transferencia.quantidade_sugerida
                            }}
                          />
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Comprar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            Como Funciona o Monitoramento por Localização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <div className="flex items-start gap-2">
            <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
              1
            </div>
            <div>
              <p className="font-semibold">Configure o Mínimo por Local</p>
              <p className="text-xs text-gray-600">
                Use o botão "Config. Mínimo por Local" para definir quantidade mínima e ideal 
                para cada produto em cada localização.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
              2
            </div>
            <div>
              <p className="font-semibold">Sistema Monitora Automaticamente</p>
              <p className="text-xs text-gray-600">
                O sistema verifica constantemente o estoque em cada local e gera alertas
                quando a quantidade fica abaixo do mínimo configurado.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
              3
            </div>
            <div>
              <p className="font-semibold">Sugestões Inteligentes de Transferência</p>
              <p className="text-xs text-gray-600">
                Quando detecta estoque baixo, o sistema sugere automaticamente transferências
                de outros locais que possuem o produto disponível.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
              4
            </div>
            <div>
              <p className="font-semibold">Execute Transferências com 1 Clique</p>
              <p className="text-xs text-gray-600">
                Use o botão de transferência para mover produtos entre locais de forma
                rápida e rastreada.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
