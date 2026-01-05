import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  TrendingUp, 
  TrendingDown,
  User,
  Package,
  Calendar,
  FileText,
  Download,
  RefreshCw,
  Filter
} from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'

export default function MovimentacoesTab() {
  const [movimentacoes, setMovimentacoes] = useState([])
  const [produtos, setProdutos] = useState([])
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [tipoFilter, setTipoFilter] = useState('todos')
  const [produtoFilter, setProdutoFilter] = useState('todos')
  const [usuarioFilter, setUsuarioFilter] = useState('todos')
  const [dataInicioFilter, setDataInicioFilter] = useState('')
  const [dataFimFilter, setDataFimFilter] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [movimentacoesData, produtosData, lotesData] = await Promise.all([
        estoqueDataService.getMovimentacoes(),
        estoqueDataService.getProdutos(),
        estoqueDataService.getLotes()
      ])

      // Ordenar movimentações por data (mais recentes primeiro)
      const movimentacoesOrdenadas = movimentacoesData.sort((a, b) => {
        return new Date(b.data_movimentacao) - new Date(a.data_movimentacao)
      })

      setMovimentacoes(movimentacoesOrdenadas)
      setProdutos(produtosData)
      setLotes(lotesData)
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err)
      setError('Erro ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar movimentações
  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter(mov => {
      // Filtro de busca
      const produto = produtos.find(p => p.id === mov.produto_id)
      const lote = lotes.find(l => l.id === mov.lote_id)
      const searchMatch = 
        produto?.nome_comercial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lote?.numero_lote?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mov.usuario_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mov.motivo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mov.paciente_nome?.toLowerCase().includes(searchTerm.toLowerCase())

      // Filtro de tipo
      const tipoMatch = tipoFilter === 'todos' || mov.tipo === tipoFilter

      // Filtro de produto
      const produtoMatch = produtoFilter === 'todos' || mov.produto_id === produtoFilter

      // Filtro de usuário
      const usuarioMatch = usuarioFilter === 'todos' || mov.usuario_nome === usuarioFilter

      // Filtro de data
      let dataMatch = true
      if (dataInicioFilter) {
        const dataInicio = new Date(dataInicioFilter)
        dataInicio.setHours(0, 0, 0, 0)
        const dataMovimentacao = new Date(mov.data_movimentacao)
        dataMatch = dataMatch && dataMovimentacao >= dataInicio
      }
      if (dataFimFilter) {
        const dataFim = new Date(dataFimFilter)
        dataFim.setHours(23, 59, 59, 999)
        const dataMovimentacao = new Date(mov.data_movimentacao)
        dataMatch = dataMatch && dataMovimentacao <= dataFim
      }

      return searchMatch && tipoMatch && produtoMatch && usuarioMatch && dataMatch
    })
  }, [movimentacoes, produtos, lotes, searchTerm, tipoFilter, produtoFilter, usuarioFilter, dataInicioFilter, dataFimFilter])

  // Estatísticas
  const stats = useMemo(() => {
    const hoje = new Date()
    const movimentacoesHoje = movimentacoes.filter(m => {
      const dataMovimentacao = new Date(m.data_movimentacao)
      return dataMovimentacao.toDateString() === hoje.toDateString()
    })

    return {
      total: movimentacoesFiltradas.length,
      entradas: movimentacoesFiltradas.filter(m => m.tipo === 'entrada').length,
      saidas: movimentacoesFiltradas.filter(m => m.tipo === 'saida').length,
      hoje: movimentacoesHoje.length,
      entradasHoje: movimentacoesHoje.filter(m => m.tipo === 'entrada').length,
      saidasHoje: movimentacoesHoje.filter(m => m.tipo === 'saida').length
    }
  }, [movimentacoes, movimentacoesFiltradas])

  // Lista de usuários únicos
  const usuariosUnicos = useMemo(() => {
    const usuarios = new Set()
    movimentacoes.forEach(mov => {
      if (mov.usuario_nome) {
        usuarios.add(mov.usuario_nome)
      }
    })
    return Array.from(usuarios).sort()
  }, [movimentacoes])

  const getProdutoNome = (id) => {
    const produto = produtos.find(p => p.id === id)
    return produto ? produto.nome_comercial : 'N/A'
  }

  const getLoteNumero = (id) => {
    const lote = lotes.find(l => l.id === id)
    return lote ? lote.numero_lote : 'N/A'
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('pt-BR', {
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

  const exportToCSV = () => {
    const headers = [
      'Data/Hora',
      'Tipo',
      'Produto',
      'Lote',
      'Quantidade',
      'Motivo',
      'Paciente',
      'Usuário',
      'Observação'
    ]

    const csvContent = [
      headers.join(','),
      ...movimentacoesFiltradas.map(mov => {
        return [
          `"${formatDateTime(mov.data_movimentacao)}"`,
          `"${mov.tipo}"`,
          `"${getProdutoNome(mov.produto_id)}"`,
          `"${getLoteNumero(mov.lote_id)}"`,
          `"${mov.quantidade}"`,
          `"${mov.motivo || ''}"`,
          `"${mov.paciente_nome || ''}"`,
          `"${mov.usuario_nome || 'Sistema'}"`,
          `"${mov.observacao || ''}"`
        ].join(',')
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `movimentacoes_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const limparFiltros = () => {
    setSearchTerm('')
    setTipoFilter('todos')
    setProdutoFilter('todos')
    setUsuarioFilter('todos')
    setDataInicioFilter('')
    setDataFimFilter('')
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
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Movimentações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.entradas} entradas / {stats.saidas} saídas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">
              Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.entradas}</div>
            <p className="text-xs text-gray-500 mt-1">
              Hoje: {stats.entradasHoje}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              Saídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.saidas}</div>
            <p className="text-xs text-gray-500 mt-1">
              Hoje: {stats.saidasHoje}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">
              Movimentações Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.hoje}</div>
            <p className="text-xs text-gray-500 mt-1">
              Últimas 24 horas
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Histórico de Movimentações
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={limparFiltros} variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
              <Button onClick={loadData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="mb-4 space-y-4">
            {/* Linha 1 - Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por produto, lote, usuário, paciente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Linha 2 - Filtros */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={produtoFilter} onValueChange={setProdutoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Produto..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os produtos</SelectItem>
                  {produtos.map(produto => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.nome_comercial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={usuarioFilter} onValueChange={setUsuarioFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Usuário..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os usuários</SelectItem>
                  {usuariosUnicos.map(usuario => (
                    <SelectItem key={usuario} value={usuario}>
                      {usuario}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={dataInicioFilter}
                onChange={(e) => setDataInicioFilter(e.target.value)}
                placeholder="Data início"
              />

              <Input
                type="date"
                value={dataFimFilter}
                onChange={(e) => setDataFimFilter(e.target.value)}
                placeholder="Data fim"
              />
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoesFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p>Nenhuma movimentação encontrada</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  movimentacoesFiltradas.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          {formatDateTime(mov.data_movimentacao)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={
                            mov.tipo === 'entrada' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {mov.tipo === 'entrada' ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {mov.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-gray-400" />
                          <span className="text-sm font-medium">
                            {getProdutoNome(mov.produto_id)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getLoteNumero(mov.lote_id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {mov.quantidade}
                      </TableCell>
                      <TableCell className="text-sm">
                        {mov.motivo || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {mov.paciente_nome || '-'}
                        {mov.paciente_cpf && (
                          <div className="text-xs text-gray-500">
                            CPF: {mov.paciente_cpf}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">
                            {mov.usuario_nome || 'Sistema'}
                          </span>
                        </div>
                        {mov.usuario_email && (
                          <div className="text-xs text-gray-500">
                            {mov.usuario_email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                        {mov.observacao || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Resumo */}
          {movimentacoesFiltradas.length > 0 && (
            <div className="mt-4 text-sm text-gray-600">
              Mostrando {movimentacoesFiltradas.length} de {movimentacoes.length} movimentações
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
