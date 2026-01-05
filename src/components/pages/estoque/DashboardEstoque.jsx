import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { 
  Package, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  DollarSign,
  Activity,
  Database,
  CheckCircle
} from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'
import { useEstoqueAlertas } from '@/hooks/estoque/useEstoqueAlertas'
import { usePopularDadosIniciais } from '@/hooks/estoque/usePopularDadosIniciais'

export default function DashboardEstoque() {
  const [estatisticas, setEstatisticas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsInitialization, setNeedsInitialization] = useState(false)
  const { alertasNaoVisualizados, alertasAlta } = useEstoqueAlertas()
  const { popularTodosDados, loading: populatingData, success: dataPopulated } = usePopularDadosIniciais()

  useEffect(() => {
    loadEstatisticas()
  }, [])

  useEffect(() => {
    if (dataPopulated) {
      // Recarregar estatísticas após popular dados
      loadEstatisticas()
    }
  }, [dataPopulated])

  const loadEstatisticas = async () => {
    try {
      setLoading(true)
      const data = await estoqueDataService.getEstatisticas()
      setEstatisticas(data)

      // Verificar se precisa inicialização
      const [categorias, fornecedores] = await Promise.all([
        estoqueDataService.getCategorias(),
        estoqueDataService.getFornecedores()
      ])

      setNeedsInitialization(categorias.length === 0 || fornecedores.length === 0)
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePopularDados = async () => {
    const result = await popularTodosDados()
    if (result.success) {
      alert(`✅ ${result.message}\n\nCategorias: ${result.stats.categorias}\nFornecedores: ${result.stats.fornecedores}\nLocalizações: ${result.stats.estoques}`)
    } else {
      alert(`❌ ${result.message}`)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
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
      {/* Alerta de Inicialização */}
      {needsInitialization && !dataPopulated && (
        <Alert className="bg-blue-50 border-blue-200">
          <Database className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-900">Sistema de Estoque Novo Detectado</p>
              <p className="text-blue-700 text-sm mt-1">
                Parece que você ainda não cadastrou categorias e fornecedores. 
                Clique no botão para criar dados iniciais automaticamente.
              </p>
            </div>
            <Button 
              onClick={handlePopularDados}
              disabled={populatingData}
              className="ml-4 bg-blue-600 hover:bg-blue-700"
            >
              {populatingData ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Criando...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Criar Dados Iniciais
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Sucesso na População */}
      {dataPopulated && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <p className="font-semibold text-green-900">✅ Dados Iniciais Criados!</p>
            <p className="text-green-700 text-sm mt-1">
              Categorias, fornecedores e localizações foram criados com sucesso. 
              Agora você pode cadastrar produtos!
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Alertas Importantes */}
      {alertasAlta.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Você tem {alertasAlta.length} alerta(s) de alta prioridade que requerem atenção imediata!
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estatisticas?.total_produtos || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              {estatisticas?.produtos_ativos || 0} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lotes Ativos</CardTitle>
            <Layers className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estatisticas?.lotes_ativos || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              de {estatisticas?.total_lotes || 0} lotes totais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movimentações Hoje</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estatisticas?.movimentacoes_hoje || 0}</div>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-600" />
                {estatisticas?.entradas_hoje || 0} entradas
              </span>
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-red-600" />
                {estatisticas?.saidas_hoje || 0} saídas
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total em Estoque</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(estatisticas?.valor_total_estoque || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Valor estimado do inventário
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Alertas Não Visualizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {alertasNaoVisualizados.length}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Requerem sua atenção
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-600" />
              Produtos em Estoque Mínimo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {alertasNaoVisualizados.filter(a => a.tipo === 'estoque_minimo').length}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Necessitam reposição
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Layers className="h-4 w-4 text-yellow-600" />
              Produtos Próximos ao Vencimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {alertasNaoVisualizados.filter(a => a.tipo === 'validade').length}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Verificar validade
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Informações Adicionais */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Produtos cadastrados:</span>
              <span className="font-semibold">{estatisticas?.total_produtos || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Produtos ativos:</span>
              <span className="font-semibold">{estatisticas?.produtos_ativos || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Lotes cadastrados:</span>
              <span className="font-semibold">{estatisticas?.total_lotes || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Lotes ativos:</span>
              <span className="font-semibold">{estatisticas?.lotes_ativos || 0}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-gray-600 font-medium">Valor total em estoque:</span>
              <span className="font-bold text-green-600">
                {formatCurrency(estatisticas?.valor_total_estoque || 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
