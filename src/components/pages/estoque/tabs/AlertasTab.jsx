import { useState } from 'react'
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
  CheckCircle, 
  Trash2, 
  RefreshCw,
  Eye,
  Calendar,
  Package,
  Layers
} from 'lucide-react'
import { useEstoqueAlertas } from '@/hooks/estoque/useEstoqueAlertas'

export default function AlertasTab() {
  const {
    alertas,
    alertasNaoVisualizados,
    alertasAlta,
    alertasMedia,
    alertasBaixa,
    loading,
    error,
    marcarVisualizado,
    deletarAlerta,
    gerarAlertas,
    refresh
  } = useEstoqueAlertas()

  const [actionLoading, setActionLoading] = useState(false)

  const handleMarcarVisualizado = async (id) => {
    try {
      setActionLoading(true)
      await marcarVisualizado(id)
    } catch (err) {
      alert('Erro ao marcar alerta como visualizado')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeletar = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este alerta?')) return

    try {
      setActionLoading(true)
      await deletarAlerta(id)
    } catch (err) {
      alert('Erro ao excluir alerta')
    } finally {
      setActionLoading(false)
    }
  }

  const handleGerarAlertas = async () => {
    try {
      setActionLoading(true)
      await gerarAlertas()
      alert('Alertas gerados com sucesso!')
    } catch (err) {
      alert('Erro ao gerar alertas')
    } finally {
      setActionLoading(false)
    }
  }

  const getPrioridadeColor = (prioridade) => {
    switch (prioridade) {
      case 'alta':
        return 'bg-red-100 text-red-800'
      case 'media':
        return 'bg-yellow-100 text-yellow-800'
      case 'baixa':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'validade':
        return Calendar
      case 'estoque_minimo':
        return Package
      case 'lote':
        return Layers
      default:
        return AlertTriangle
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total de Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alertas.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              Alta Prioridade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{alertasAlta.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">
              Média Prioridade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{alertasMedia.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">
              Baixa Prioridade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{alertasBaixa.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas do Sistema
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={refresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button onClick={handleGerarAlertas} disabled={actionLoading}>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Gerar Alertas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {alertasNaoVisualizados.length > 0 && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Você tem {alertasNaoVisualizados.length} alerta(s) não visualizado(s)
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle className="h-12 w-12 text-green-500" />
                        <p className="font-medium">Nenhum alerta no momento</p>
                        <p className="text-sm">Seu estoque está em ordem!</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  alertas.map((alerta) => {
                    const TipoIcon = getTipoIcon(alerta.tipo)
                    return (
                      <TableRow 
                        key={alerta.id}
                        className={!alerta.visualizado ? 'bg-yellow-50' : ''}
                      >
                        <TableCell>
                          <TipoIcon className="h-5 w-5 text-gray-500" />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {alerta.tipo === 'validade' ? 'Validade' : 
                             alerta.tipo === 'estoque_minimo' ? 'Estoque' : 
                             alerta.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPrioridadeColor(alerta.prioridade)}>
                            {alerta.prioridade === 'alta' ? 'Alta' :
                             alerta.prioridade === 'media' ? 'Média' :
                             'Baixa'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {alerta.titulo}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-md">
                          {alerta.mensagem}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(alerta.data_criacao)}
                        </TableCell>
                        <TableCell>
                          {alerta.visualizado ? (
                            <Badge className="bg-gray-100 text-gray-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Visualizado
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Novo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!alerta.visualizado && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleMarcarVisualizado(alerta.id)}
                                disabled={actionLoading}
                                title="Marcar como visualizado"
                              >
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeletar(alerta.id)}
                              disabled={actionLoading}
                              title="Excluir alerta"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Informações sobre os alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sobre os Alertas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p>
            <strong>Alertas de Validade:</strong> São gerados automaticamente para produtos que vencerão em 30, 60 ou 90 dias.
          </p>
          <p>
            <strong>Alertas de Estoque Mínimo:</strong> Notificam quando produtos atingem o estoque mínimo configurado ou ficam zerados.
          </p>
          <p>
            <strong>Prioridades:</strong> Alta (vermelho) requer ação imediata, Média (amarelo) requer atenção, Baixa (azul) é informativa.
          </p>
          <p className="mt-4 text-xs text-gray-500">
            Os alertas são atualizados automaticamente a cada 5 minutos. Você também pode gerar alertas manualmente clicando no botão "Gerar Alertas".
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
