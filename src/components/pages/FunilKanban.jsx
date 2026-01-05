import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  X, 
  ArrowLeft, 
  Search, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign,
  User,
  ChevronRight,
  TrendingUp,
  Filter,
  Eye,
  UserPlus,
  AlertTriangle,
  Loader2,
  Tag
} from 'lucide-react'

// Configuração das colunas do funil
const FUNIL_COLUMNS = [
  { 
    id: 'sem_interacao', 
    title: 'Sem Interação', 
    status: 'Sem Interação',
    color: 'bg-gray-100 border-gray-300',
    textColor: 'text-gray-800',
    icon: User
  },
  { 
    id: 'em_conversa', 
    title: 'Em Conversa', 
    status: 'Em Conversa',
    color: 'bg-blue-100 border-blue-300',
    textColor: 'text-blue-800',
    icon: Phone
  },
  { 
    id: 'agendado', 
    title: 'Agendado', 
    status: 'Agendado',
    color: 'bg-yellow-100 border-yellow-300',
    textColor: 'text-yellow-800',
    icon: Calendar
  },
  { 
    id: 'confirmado', 
    title: 'Confirmado', 
    status: 'Confirmado',
    color: 'bg-purple-100 border-purple-300',
    textColor: 'text-purple-800',
    icon: UserPlus
  },
  { 
    id: 'convertido', 
    title: 'Convertido', 
    status: 'Convertido',
    color: 'bg-green-100 border-green-300',
    textColor: 'text-green-800',
    icon: TrendingUp
  }
]

export default function FunilKanban({ leads, medicos, especialidades, tags, onUpdateLead, onClose }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedColumn, setSelectedColumn] = useState(null)
  const [draggedLead, setDraggedLead] = useState(null)
  const [filteredLeads, setFilteredLeads] = useState(leads)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Filtrar leads baseado na pesquisa
    if (searchTerm.trim()) {
      const filtered = leads.filter(lead => 
        lead.nome_paciente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.telefone?.includes(searchTerm) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredLeads(filtered)
    } else {
      setFilteredLeads(leads)
    }
  }, [searchTerm, leads])

  const getLeadsByColumn = (columnStatus) => {
    return filteredLeads.filter(lead => lead.status === columnStatus)
  }

  const getMedicoNome = (id) => {
    const medico = medicos.find(m => m.id === id)
    return medico ? medico.nome : 'N/A'
  }

  const getEspecialidadeNome = (id) => {
    const especialidade = especialidades.find(e => e.id === id)
    return especialidade ? especialidade.nome : 'N/A'
  }

  const getTagById = (tagId) => {
    return tags?.find(tag => tag.id === tagId)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Não informado'
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const handleDragStart = (e, lead) => {
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e, columnStatus) => {
    e.preventDefault()
    
    if (!draggedLead || draggedLead.status === columnStatus) {
      setDraggedLead(null)
      return
    }

    try {
      setUpdating(true)
      setError(null)

      // Atualizar o status do lead
      const updatedLead = {
        ...draggedLead,
        status: columnStatus
      }

      await onUpdateLead(draggedLead.id, updatedLead)
      setDraggedLead(null)
    } catch (err) {
      console.error('Erro ao atualizar lead:', err)
      setError('Erro ao mover o lead. Tente novamente.')
    } finally {
      setUpdating(false)
    }
  }

  const handleDragEnd = () => {
    setDraggedLead(null)
  }

  // Calcular estatísticas
  const stats = {
    total: filteredLeads.length,
    semInteracao: getLeadsByColumn('Sem Interação').length,
    emConversa: getLeadsByColumn('Em Conversa').length,
    agendado: getLeadsByColumn('Agendado').length,
    confirmado: getLeadsByColumn('Confirmado').length,
    convertido: getLeadsByColumn('Convertido').length,
    valorTotal: filteredLeads.reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0),
    valorConvertido: getLeadsByColumn('Convertido').reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0)
  }

  const taxaConversao = stats.total > 0 ? ((stats.convertido / stats.total) * 100).toFixed(1) : 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex flex-col">
      <div className="flex-1 bg-white flex flex-col overflow-hidden">
        {/* Loading Overlay */}
        {updating && (
          <div className="absolute inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-gray-900 font-medium">Atualizando lead...</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="absolute top-4 right-4 z-50 max-w-md">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                {error}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setError(null)}
                  className="ml-2 h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 shadow-lg flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Funil de Vendas - Kanban</h1>
                <p className="text-blue-100 text-sm">Arraste os cards para mover entre as etapas</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Barra de pesquisa */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-5 w-5" />
            <Input
              type="text"
              placeholder="Buscar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
            />
          </div>
        </div>

        {/* Estatísticas */}
        <div className="bg-gray-50 border-b p-4 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card className="bg-white border-2 border-blue-200">
              <CardContent className="p-3">
                <div className="text-xs text-gray-600 mb-1">Total de Leads</div>
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              </CardContent>
            </Card>
            
            {FUNIL_COLUMNS.map(column => {
              const count = getLeadsByColumn(column.status).length
              const percentage = stats.total > 0 ? ((count / stats.total) * 100).toFixed(0) : 0
              
              return (
                <Card key={column.id} className={`bg-white border-2 ${column.color.replace('bg-', 'border-')}`}>
                  <CardContent className="p-3">
                    <div className="text-xs text-gray-600 mb-1">{column.title}</div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-2xl font-bold text-gray-900">{count}</div>
                      <div className="text-xs text-gray-500">{percentage}%</div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200">
              <CardContent className="p-3">
                <div className="text-xs text-green-700 mb-1">Taxa de Conversão</div>
                <div className="text-2xl font-bold text-green-800">{taxaConversao}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Valores */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Card className="bg-blue-50 border-2 border-blue-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-blue-700 mb-1">Valor Total em Pipeline</div>
                    <div className="text-xl font-bold text-blue-900">{formatCurrency(stats.valorTotal)}</div>
                  </div>
                  <DollarSign className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-2 border-green-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-green-700 mb-1">Valor Convertido</div>
                    <div className="text-xl font-bold text-green-900">{formatCurrency(stats.valorConvertido)}</div>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Kanban Board - ALTURA FIXA COM OVERFLOW */}
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-4 p-4 h-full overflow-x-auto">
            {FUNIL_COLUMNS.map(column => {
              const columnLeads = getLeadsByColumn(column.status)
              const columnValue = columnLeads.reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0)
              const Icon = column.icon

              return (
                <div
                  key={column.id}
                  className="flex-shrink-0 w-80 h-full"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.status)}
                >
                  <Card className={`h-full flex flex-col border-2 ${column.color}`}>
                    <CardHeader className="pb-3 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-5 w-5 ${column.textColor}`} />
                          <CardTitle className={`text-sm font-semibold ${column.textColor}`}>
                            {column.title}
                          </CardTitle>
                        </div>
                        <Badge variant="secondary" className="bg-white">
                          {columnLeads.length}
                        </Badge>
                      </div>
                      {columnValue > 0 && (
                        <div className={`text-xs font-medium ${column.textColor}`}>
                          {formatCurrency(columnValue)}
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto space-y-3 pt-0">
                      {columnLeads.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <Filter className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhum lead</p>
                        </div>
                      ) : (
                        columnLeads.map(lead => (
                          <Card
                            key={lead.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, lead)}
                            onDragEnd={handleDragEnd}
                            className={`cursor-move hover:shadow-lg transition-all ${
                              draggedLead?.id === lead.id ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
                            } bg-white border hover:border-blue-400`}
                          >
                            <CardContent className="p-3">
                              <div className="space-y-2">
                                {/* Nome do paciente */}
                                <div className="flex items-start justify-between">
                                  <h4 className="font-semibold text-sm text-gray-900 flex-1">
                                    {lead.nome_paciente}
                                  </h4>
                                  {lead.tipo_visita === 'Recorrente' && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                                      Recorrente
                                    </Badge>
                                  )}
                                </div>

                                {/* Informações de contato */}
                                <div className="space-y-1 text-xs text-gray-600">
                                  {lead.telefone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      <span>{lead.telefone}</span>
                                    </div>
                                  )}
                                  {lead.email && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      <span className="truncate">{lead.email}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Médico e Especialidade */}
                                <div className="text-xs bg-gray-50 rounded p-2">
                                  <div className="font-medium text-gray-700">
                                    {getMedicoNome(lead.medico_agendado_id)}
                                  </div>
                                  <div className="text-gray-500">
                                    {getEspecialidadeNome(lead.especialidade_id)}
                                  </div>
                                </div>

                                {/* Outros profissionais */}
                                {lead.outros_profissionais?.some(prof => prof.ativo) && (
                                  <div className="text-xs bg-blue-50 rounded p-2">
                                    <div className="font-medium text-blue-700 mb-1">
                                      Outros Profissionais:
                                    </div>
                                    {lead.outros_profissionais
                                      .filter(prof => prof.ativo)
                                      .slice(0, 2)
                                      .map((prof, index) => (
                                        <div key={index} className="text-blue-600 text-xs">
                                          • {getMedicoNome(prof.medico_id)}
                                        </div>
                                      ))}
                                    {lead.outros_profissionais.filter(prof => prof.ativo).length > 2 && (
                                      <div className="text-blue-500 text-xs mt-1">
                                        +{lead.outros_profissionais.filter(prof => prof.ativo).length - 2} outros
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Valor */}
                                {lead.valor_orcado > 0 && (
                                  <div className="flex items-center justify-between pt-2 border-t">
                                    <div className="flex items-center gap-1 text-sm font-semibold text-green-700">
                                      <DollarSign className="h-4 w-4" />
                                      {formatCurrency(lead.valor_orcado)}
                                    </div>
                                    {lead.canal_contato && (
                                      <Badge variant="outline" className="text-xs">
                                        {lead.canal_contato}
                                      </Badge>
                                    )}
                                  </div>
                                )}

                                {/* Data de registro */}
                                <div className="flex items-center gap-1 text-xs text-gray-500 pt-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>{formatDate(lead.data_registro_contato)}</span>
                                </div>

                                {/* Tags */}
                                {lead.tags && lead.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {lead.tags.slice(0, 3).map((tagId) => {
                                      const tag = getTagById(tagId)
                                      return tag ? (
                                        <span
                                          key={tagId}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-white text-xs font-medium"
                                          style={{ backgroundColor: tag.cor }}
                                          title={tag.nome}
                                        >
                                          <Tag className="h-3 w-3" />
                                          {tag.nome}
                                        </span>
                                      ) : null
                                    })}
                                    {lead.tags.length > 3 && (
                                      <span className="inline-block px-2 py-1 rounded-full bg-gray-200 text-gray-700 text-xs">
                                        +{lead.tags.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer com instruções */}
        <div className="bg-gray-50 border-t p-4 flex-shrink-0">
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Arraste os cards entre as colunas para atualizar o status</span>
            </div>
            <ChevronRight className="h-4 w-4" />
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span>Total: {stats.total} leads • Convertidos: {stats.convertido} ({taxaConversao}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
