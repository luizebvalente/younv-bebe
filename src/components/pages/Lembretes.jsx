import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Calendar, Search, Filter, Trash2, CheckCircle, AlertCircle, Plus, User, Phone, Mail, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import firebaseDataService from '@/services/firebaseDataService'
import { parseLocalDate } from '@/constants/crm'

export default function Lembretes() {
  // ESTADOS PRINCIPAIS
  const [lembretes, setLembretes] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // ESTADOS DE FILTROS
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos') // Todos, Pendente, Concluído, Vencido
  const [dateFilter, setDateFilter] = useState('Todos') // Todos, Hoje, Amanhã, Esta Semana, Próximos 7 dias
  const [userFilter, setUserFilter] = useState('Todos') // Filtro por usuário criador
  
  // ESTADOS DE PAGINAÇÃO
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  
  // Hooks
  const { user } = useAuth()
  const navigate = useNavigate()

  // CARREGAR LEMBRETES E LEADS
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [lembretesData, leadsData] = await Promise.all([
        firebaseDataService.getAll('lembretes'),
        firebaseDataService.getAll('leads')
      ])
      
      setLembretes(lembretesData || [])
      setLeads(leadsData || [])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar lembretes')
    } finally {
      setLoading(false)
    }
  }

  // Mapa id→lead: lookup O(1) (antes era find() linear chamado por lembrete no filtro E no render)
  const leadsById = useMemo(() => {
    const map = new Map()
    leads.forEach(lead => map.set(lead.id, lead))
    return map
  }, [leads])

  const getLeadById = (leadId) => leadsById.get(leadId)

  // FUNÇÃO PARA MARCAR LEMBRETE COMO CONCLUÍDO
  const handleConcluirLembrete = async (lembreteId) => {
    try {
      const lembrete = lembretes.find(l => l.id === lembreteId)
      if (!lembrete) return

      const updatedLembrete = {
        ...lembrete,
        status: 'Concluído',
        data_conclusao: new Date().toISOString()
      }

      await firebaseDataService.update('lembretes', lembreteId, updatedLembrete)
      
      // Atualizar estado local
      setLembretes(prev => prev.map(l => 
        l.id === lembreteId ? { ...l, ...updatedLembrete } : l
      ))
    } catch (err) {
      console.error('Erro ao concluir lembrete:', err)
      alert('Erro ao concluir lembrete')
    }
  }

  // FUNÇÃO PARA EXCLUIR LEMBRETE
  const handleExcluirLembrete = async (lembreteId) => {
    if (!confirm('Deseja realmente excluir este lembrete?')) return

    try {
      await firebaseDataService.delete('lembretes', lembreteId)
      setLembretes(prev => prev.filter(l => l.id !== lembreteId))
    } catch (err) {
      console.error('Erro ao excluir lembrete:', err)
      alert('Erro ao excluir lembrete')
    }
  }

  // FUNÇÃO PARA DETERMINAR STATUS DO LEMBRETE
  // parseLocalDate: 'YYYY-MM-DD' como data LOCAL — com new Date() (UTC) um lembrete
  // de HOJE aparecia como "Vencido" no fuso do Brasil
  const getStatusLembrete = (lembrete) => {
    if (lembrete.status === 'Concluído') return 'Concluído'

    const dataLembrete = parseLocalDate(lembrete.data_lembrete)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    if (dataLembrete < hoje) return 'Vencido'
    return 'Pendente'
  }

  // FUNÇÃO PARA OBTER COR DO STATUS
  const getStatusColor = (status) => {
    switch (status) {
      case 'Concluído':
        return 'bg-green-100 text-green-800'
      case 'Vencido':
        return 'bg-red-100 text-red-800'
      case 'Pendente':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // FUNÇÃO PARA FORMATAR DATA (parse local — evita exibir 1 dia antes)
  const formatarData = (dataString) => {
    if (!dataString) return '-'
    const data = parseLocalDate(dataString)
    return data.toLocaleDateString('pt-BR')
  }

  // FUNÇÃO PARA VERIFICAR SE É HOJE
  const isHoje = (dataString) => {
    const data = parseLocalDate(dataString)
    const hoje = new Date()
    return data.toDateString() === hoje.toDateString()
  }

  // FUNÇÃO PARA VERIFICAR SE É AMANHÃ
  const isAmanha = (dataString) => {
    const data = parseLocalDate(dataString)
    const amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    return data.toDateString() === amanha.toDateString()
  }

  // FILTRAR LEMBRETES
  const filteredLembretes = useMemo(() => {
    let filtered = lembretes.map(lembrete => ({
      ...lembrete,
      statusCalculado: getStatusLembrete(lembrete)
    }))

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(lembrete => {
        const lead = getLeadById(lembrete.lead_id)
        return (
          lembrete.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead?.nome_paciente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead?.telefone?.includes(searchTerm)
        )
      })
    }

    // Filtro de status
    if (statusFilter !== 'Todos') {
      filtered = filtered.filter(lembrete => lembrete.statusCalculado === statusFilter)
    }

    // Filtro de data
    if (dateFilter !== 'Todos') {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      
      filtered = filtered.filter(lembrete => {
        const dataLembrete = parseLocalDate(lembrete.data_lembrete)
        dataLembrete.setHours(0, 0, 0, 0)
        
        switch (dateFilter) {
          case 'Hoje':
            return isHoje(lembrete.data_lembrete)
          case 'Amanhã':
            return isAmanha(lembrete.data_lembrete)
          case 'Esta Semana': {
            const fimSemana = new Date(hoje)
            fimSemana.setDate(hoje.getDate() + (7 - hoje.getDay()))
            return dataLembrete >= hoje && dataLembrete <= fimSemana
          }
          case 'Próximos 7 dias': {
            const proximos7 = new Date(hoje)
            proximos7.setDate(hoje.getDate() + 7)
            return dataLembrete >= hoje && dataLembrete <= proximos7
          }
          default:
            return true
        }
      })
    }

    // Filtro por usuário criador
    if (userFilter !== 'Todos') {
      filtered = filtered.filter(lembrete => lembrete.criado_por_nome === userFilter)
    }

    // Ordenar por data (mais próximos primeiro)
    filtered.sort((a, b) => new Date(a.data_lembrete) - new Date(b.data_lembrete))

    return filtered
  }, [lembretes, leads, searchTerm, statusFilter, dateFilter, userFilter])

  // PAGINAÇÃO
  const totalPages = Math.ceil(filteredLembretes.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedLembretes = filteredLembretes.slice(startIndex, endIndex)

  // ESTATÍSTICAS
  const stats = useMemo(() => {
    const total = lembretes.length
    const pendentes = lembretes.filter(l => getStatusLembrete(l) === 'Pendente').length
    const vencidos = lembretes.filter(l => getStatusLembrete(l) === 'Vencido').length
    const concluidos = lembretes.filter(l => l.status === 'Concluído').length
    const hoje = lembretes.filter(l => isHoje(l.data_lembrete) && getStatusLembrete(l) !== 'Concluído').length

    return { total, pendentes, vencidos, concluidos, hoje }
  }, [lembretes])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando lembretes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lembretes de Leads</h1>
          <p className="text-gray-500 mt-1">Gerencie todos os seus lembretes de contato</p>
        </div>
      </div>

      {/* CARDS DE ESTATÍSTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.hoje}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendentes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Vencidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.vencidos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Concluídos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.concluidos}</div>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Busca */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Nome, telefone ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtro de Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Todos">Todos</option>
                <option value="Pendente">Pendente</option>
                <option value="Vencido">Vencido</option>
                <option value="Concluído">Concluído</option>
              </select>
            </div>

            {/* Filtro de Data */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Período
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Todos">Todos</option>
                <option value="Hoje">Hoje</option>
                <option value="Amanhã">Amanhã</option>
                <option value="Esta Semana">Esta Semana</option>
                <option value="Próximos 7 dias">Próximos 7 dias</option>
              </select>
            </div>

            {/* Filtro de Usuário */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Criado por
              </label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Todos">Todos</option>
                {[...new Set(lembretes.map(l => l.criado_por_nome))].filter(Boolean).sort().map(nome => (
                  <option key={nome} value={nome}>{nome}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LISTA DE LEMBRETES */}
      <Card>
        <CardHeader>
          <CardTitle>Lembretes ({filteredLembretes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {paginatedLembretes.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">Nenhum lembrete encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedLembretes.map((lembrete) => {
                const lead = getLeadById(lembrete.lead_id)
                const status = lembrete.statusCalculado

                return (
                  <div
                    key={lembrete.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={getStatusColor(status)}>
                            {status}
                          </Badge>
                          <div className="flex items-center text-sm text-gray-600">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatarData(lembrete.data_lembrete)}
                          </div>
                          {isHoje(lembrete.data_lembrete) && (
                            <Badge className="bg-blue-100 text-blue-800">
                              Hoje
                            </Badge>
                          )}
                        </div>

                        <h3 className="font-semibold text-gray-900 mb-2">
                          {lembrete.descricao || 'Sem descrição'}
                        </h3>

                        {lead && (
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-2" />
                              <span className="font-medium">{lead.nome_paciente}</span>
                            </div>
                            {lead.telefone && (
                              <div className="flex items-center">
                                <Phone className="h-4 w-4 mr-2" />
                                <span>{lead.telefone}</span>
                              </div>
                            )}
                            {lead.email && (
                              <div className="flex items-center">
                                <Mail className="h-4 w-4 mr-2" />
                                <span>{lead.email}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {lembrete.observacoes && (
                          <p className="mt-2 text-sm text-gray-500">
                            {lembrete.observacoes}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/leads', { state: { openLeadId: lembrete.lead_id } })}
                          className="text-blue-600 hover:text-blue-700"
                          title="Abrir Lead"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {status !== 'Concluído' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConcluirLembrete(lembrete.id)}
                            className="text-green-600 hover:text-green-700"
                            title="Marcar como Concluído"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExcluirLembrete(lembrete.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Excluir Lembrete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* PAGINAÇÃO */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-gray-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredLembretes.length)} de {filteredLembretes.length} lembretes
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-4 py-2 text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
