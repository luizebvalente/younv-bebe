import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ShoppingBag, 
  Package, 
  DollarSign, 
  Calendar,
  TrendingUp,
  User,
  Download,
  AlertCircle
} from 'lucide-react'
import firebaseDataService from '@/services/firebaseDataService'

/**
 * 🛍️ COMPONENTE DE HISTÓRICO DE CONSUMO DO PACIENTE
 * 
 * Funcionalidades:
 * - Lista completa de produtos consumidos pelo paciente
 * - Estatísticas: ticket médio, total gasto, número de consumos
 * - Top 5 produtos mais consumidos
 * - Exportação para CSV
 * - Integração com módulo de estoque
 * 
 * Props:
 * @param {string} pacienteId - ID do paciente/lead
 * @param {ReactNode} trigger - Elemento customizado para abrir o diálogo (opcional)
 */
export default function HistoricoConsumoPaciente({ pacienteId, trigger }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paciente, setPaciente] = useState(null)
  const [historico, setHistorico] = useState([])

  useEffect(() => {
    if (isOpen && pacienteId) {
      loadHistorico()
    }
  }, [isOpen, pacienteId])

  const loadHistorico = async () => {
    try {
      setLoading(true)
      const pacienteData = await firebaseDataService.getById('leads', pacienteId)
      
      if (pacienteData) {
        setPaciente(pacienteData)
        setHistorico(pacienteData.historico_consumo || [])
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return '-'
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const exportToCSV = () => {
    if (!historico || historico.length === 0) {
      alert('Nenhum dado para exportar')
      return
    }

    const headers = [
      'Data',
      'Produto',
      'Lote',
      'Quantidade',
      'Valor Unitário',
      'Valor Total',
      'Local',
      'Responsável',
      'Observação'
    ]

    const csvContent = [
      headers.join(','),
      ...historico.map(item => [
        `"${formatDate(item.data)}"`,
        `"${item.produto_nome || ''}"`,
        `"${item.lote_numero || ''}"`,
        `"${item.quantidade || 0}"`,
        `"${formatCurrency(item.valor_unitario || 0)}"`,
        `"${formatCurrency(item.valor_total || 0)}"`,
        `"${item.estoque_nome || ''}"`,
        `"${item.usuario_nome || ''}"`,
        `"${item.observacao || ''}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `historico_${paciente?.nome_paciente?.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Agrupar por produto para estatísticas
  const produtosAgrupados = historico.reduce((acc, item) => {
    const produtoId = item.produto_id
    if (!acc[produtoId]) {
      acc[produtoId] = {
        produto_nome: item.produto_nome,
        quantidade_total: 0,
        valor_total: 0,
        numero_consumos: 0
      }
    }
    acc[produtoId].quantidade_total += item.quantidade || 0
    acc[produtoId].valor_total += item.valor_total || 0
    acc[produtoId].numero_consumos += 1
    return acc
  }, {})

  const produtosMaisConsumidos = Object.values(produtosAgrupados)
    .sort((a, b) => b.numero_consumos - a.numero_consumos)
    .slice(0, 5)

  return (
    <>
      {trigger ? (
        <div onClick={() => setIsOpen(true)} style={{ cursor: 'pointer' }}>
          {trigger}
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          Histórico de Consumo
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="!max-w-[80vw] max-h-[90vh] overflow-y-auto p-6 w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-green-600" />
              Histórico de Consumo de Produtos
            </DialogTitle>
            {paciente && (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-600">
                  Paciente: <span className="font-semibold">{paciente.nome_paciente}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {paciente.telefone} • {paciente.email}
                </p>
              </div>
            )}
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-200 border-t-green-600"></div>
            </div>
          ) : historico.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum consumo registrado
              </h3>
              <p className="text-gray-600">
                Este paciente ainda não tem produtos consumidos registrados.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Os consumos são registrados automaticamente através do módulo de estoque.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Cards de Estatísticas */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4" />
                      Total de Consumos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {historico.length}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Total Gasto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(paciente?.total_gasto_produtos || 0)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Ticket Médio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(paciente?.ticket_medio_produtos || 0)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Última Compra
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-semibold text-orange-600">
                      {formatDate(paciente?.ultima_compra_data)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Produtos Mais Consumidos */}
              {produtosMaisConsumidos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Top 5 Produtos Mais Consumidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {produtosMaisConsumidos.map((produto, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-green-100 text-green-800">
                              #{index + 1}
                            </Badge>
                            <div>
                              <p className="font-medium">{produto.produto_nome}</p>
                              <p className="text-sm text-gray-600">
                                {produto.numero_consumos} consumo(s) • 
                                Qtd total: {produto.quantidade_total}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">
                              {formatCurrency(produto.valor_total)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabela de Histórico */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Histórico Completo</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToCSV}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Valor Unit.</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead>Local</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Observação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historico
                          .sort((a, b) => new Date(b.data) - new Date(a.data))
                          .map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3 text-gray-400" />
                                  {formatDate(item.data)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Package className="h-3 w-3 text-blue-600" />
                                  <span className="font-medium">{item.produto_nome}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {item.lote_numero}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {item.quantidade}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.valor_unitario)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {formatCurrency(item.valor_total)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.estoque_nome}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-blue-600" />
                                  <span className="text-sm">{item.usuario_nome}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                                {item.observacao || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
