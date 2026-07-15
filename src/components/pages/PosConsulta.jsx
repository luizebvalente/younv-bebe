import { useState, useEffect, useMemo, useCallback } from 'react'
import { ClipboardCheck, Search, Loader2, Calendar, Phone, User, Trash2, ChevronDown, ChevronUp, Plus, X, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/AuthContext'
import firebaseDataService from '@/services/firebaseDataService'
import { parseLocalDate } from '@/constants/crm'

export default function PosConsulta() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('recentes')

  // Data states
  const [leads, setLeads] = useState([])
  const [medicos, setMedicos] = useState([])
  const [registros, setRegistros] = useState([])

  // UI states
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  // Modal state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [formData, setFormData] = useState({
    resumo_atendimento: '',
    orientacoes_paciente: '',
    proximo_retorno: '',
    observacoes_internas: ''
  })

  // Registros tab filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [expandedRegistro, setExpandedRegistro] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [leadsData, medicosData, registrosData] = await Promise.all([
        firebaseDataService.getAll('leads'),
        firebaseDataService.getAll('medicos'),
        firebaseDataService.getAll('pos_consulta')
      ])
      setLeads(leadsData)
      setMedicos(medicosData)
      setRegistros(registrosData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Patients with recent activity (last 30 days)
  const pacientesRecentes = useMemo(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    return leads.filter(lead => {
      if (lead.status !== 'Convertido' && lead.status !== 'Agendado') return false

      const dataRegistro = lead.data_registro_contato ? new Date(lead.data_registro_contato) : null
      return dataRegistro && dataRegistro >= thirtyDaysAgo
    }).sort((a, b) => new Date(b.data_registro_contato) - new Date(a.data_registro_contato))
  }, [leads])

  // Filtered registros
  const filteredRegistros = useMemo(() => {
    let filtered = [...registros]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(r =>
        r.nome_paciente?.toLowerCase().includes(term) ||
        r.resumo_atendimento?.toLowerCase().includes(term)
      )
    }

    if (filtroDataInicio) {
      const start = parseLocalDate(filtroDataInicio)
      start.setHours(0, 0, 0, 0)
      filtered = filtered.filter(r => {
        const data = r.data_criacao ? new Date(r.data_criacao) : null
        return data && data >= start
      })
    }

    if (filtroDataFim) {
      const end = parseLocalDate(filtroDataFim)
      end.setHours(23, 59, 59, 999)
      filtered = filtered.filter(r => {
        const data = r.data_criacao ? new Date(r.data_criacao) : null
        return data && data <= end
      })
    }

    return filtered.sort((a, b) => new Date(b.data_criacao) - new Date(a.data_criacao))
  }, [registros, searchTerm, filtroDataInicio, filtroDataFim])

  const getMedicoNome = (id) => {
    const medico = medicos.find(m => m.id === id)
    return medico ? medico.nome : 'N/A'
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      // parseLocalDate: 'YYYY-MM-DD' como data local (evita exibir 1 dia antes)
      return parseLocalDate(dateString).toLocaleDateString('pt-BR')
    } catch {
      return 'Data inválida'
    }
  }

  const openRegistroDialog = (lead) => {
    setSelectedLead(lead)
    setFormData({
      resumo_atendimento: '',
      orientacoes_paciente: '',
      proximo_retorno: '',
      observacoes_internas: ''
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!selectedLead) return

    try {
      setSaving(true)
      setError(null)

      const userInfo = firebaseDataService.getCurrentUserInfo()

      const registroData = {
        lead_id: selectedLead.id,
        nome_paciente: selectedLead.nome_paciente,
        data_consulta: selectedLead.data_registro_contato || new Date().toISOString(),
        resumo_atendimento: formData.resumo_atendimento,
        orientacoes_paciente: formData.orientacoes_paciente,
        proximo_retorno: formData.proximo_retorno,
        observacoes_internas: formData.observacoes_internas,
        criado_por_id: userInfo.id,
        criado_por_nome: userInfo.nome,
        data_criacao: new Date().toISOString()
      }

      await firebaseDataService.create('pos_consulta', registroData)

      // If proximo_retorno is set, create a lembrete
      if (formData.proximo_retorno) {
        const lembreteData = {
          lead_id: selectedLead.id,
          data_lembrete: formData.proximo_retorno,
          descricao: 'Follow-up Pós-Consulta',
          observacoes: `Retorno agendado para ${selectedLead.nome_paciente}`,
          status: 'Pendente',
          criado_por_id: userInfo.id,
          criado_por_nome: userInfo.nome,
          criado_por_email: userInfo.email,
          data_criacao: new Date().toISOString()
        }

        await firebaseDataService.create('lembretes', lembreteData)
      }

      setIsDialogOpen(false)
      setSelectedLead(null)
      setSuccessMessage('Registro de pós-consulta salvo com sucesso!' + (formData.proximo_retorno ? ' Lembrete de retorno criado.' : ''))
      await loadData()

      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      console.error('Erro ao salvar registro:', err)
      setError('Erro ao salvar registro. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRegistro = async (registroId) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return

    try {
      await firebaseDataService.delete('pos_consulta', registroId)
      await loadData()
      setExpandedRegistro(null)
      setSuccessMessage('Registro excluído com sucesso!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      console.error('Erro ao excluir registro:', err)
      setError('Erro ao excluir registro.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-600">Carregando...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8 text-teal-600" />
            Pós-Consulta
          </h1>
          <p className="text-gray-600 mt-1">Acompanhamento e orientações pós-atendimento</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('recentes')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'recentes' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Pacientes Recentes ({pacientesRecentes.length})
        </button>
        <button
          onClick={() => setActiveTab('registros')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'registros' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Registros Salvos ({registros.length})
        </button>
      </div>

      {/* Tab: Pacientes Recentes */}
      {activeTab === 'recentes' && (
        <div className="space-y-4">
          {pacientesRecentes.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="text-center py-12">
                <ClipboardCheck className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Nenhum paciente com consulta nos últimos 30 dias.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {pacientesRecentes.map(lead => (
                <Card key={lead.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{lead.nome_paciente}</p>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {lead.telefone}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" /> {getMedicoNome(lead.medico_agendado_id)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {formatDate(lead.data_registro_contato)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${
                          lead.status === 'Convertido' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {lead.status}
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => openRegistroDialog(lead)}
                          className="bg-teal-600 hover:bg-teal-700"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Registrar Pós-Consulta
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Registros Salvos */}
      {activeTab === 'registros' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar por paciente ou resumo..."
                      className="pl-10 h-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                    className="h-10 w-40"
                    placeholder="Data início"
                  />
                  <Input
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                    className="h-10 w-40"
                    placeholder="Data fim"
                  />
                  {(searchTerm || filtroDataInicio || filtroDataFim) && (
                    <Button variant="outline" size="sm" onClick={() => {
                      setSearchTerm('')
                      setFiltroDataInicio('')
                      setFiltroDataFim('')
                    }}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Registros List */}
          {filteredRegistros.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="text-center py-12">
                <ClipboardCheck className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Nenhum registro encontrado.</p>
              </CardContent>
            </Card>
          ) : (
            filteredRegistros.map(registro => (
              <Card key={registro.id} className="border-0 shadow-md">
                <CardContent className="p-0">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedRegistro(expandedRegistro === registro.id ? null : registro.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                        <ClipboardCheck className="h-5 w-5 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{registro.nome_paciente}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>Consulta: {formatDate(registro.data_consulta)}</span>
                          <span>Registrado: {formatDate(registro.data_criacao)}</span>
                          <span>por {registro.criado_por_nome}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {registro.proximo_retorno && (
                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                          Retorno: {formatDate(registro.proximo_retorno)}
                        </Badge>
                      )}
                      {expandedRegistro === registro.id ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {expandedRegistro === registro.id && (
                    <div className="border-t p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {registro.resumo_atendimento && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-sm font-medium text-gray-700 mb-1">Resumo do Atendimento</p>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{registro.resumo_atendimento}</p>
                          </div>
                        )}
                        {registro.orientacoes_paciente && (
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-sm font-medium text-blue-700 mb-1">Orientações ao Paciente</p>
                            <p className="text-sm text-blue-600 whitespace-pre-wrap">{registro.orientacoes_paciente}</p>
                          </div>
                        )}
                        {registro.proximo_retorno && (
                          <div className="bg-green-50 p-3 rounded-lg">
                            <p className="text-sm font-medium text-green-700 mb-1">Próximo Retorno</p>
                            <p className="text-sm text-green-600">{formatDate(registro.proximo_retorno)}</p>
                          </div>
                        )}
                        {registro.observacoes_internas && (
                          <div className="bg-yellow-50 p-3 rounded-lg">
                            <p className="text-sm font-medium text-yellow-700 mb-1">Observações Internas</p>
                            <p className="text-sm text-yellow-600 whitespace-pre-wrap">{registro.observacoes_internas}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteRegistro(registro.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Excluir
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Dialog: Registrar Pós-Consulta */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-teal-600" />
              Registrar Pós-Consulta
            </DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-semibold">{selectedLead.nome_paciente}</p>
                <p className="text-sm text-gray-500">{selectedLead.telefone} - {getMedicoNome(selectedLead.medico_agendado_id)}</p>
              </div>

              <div className="space-y-2">
                <Label>Resumo do Atendimento</Label>
                <Textarea
                  value={formData.resumo_atendimento}
                  onChange={(e) => setFormData(prev => ({ ...prev, resumo_atendimento: e.target.value }))}
                  placeholder="O que foi realizado na consulta..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Orientações ao Paciente</Label>
                <Textarea
                  value={formData.orientacoes_paciente}
                  onChange={(e) => setFormData(prev => ({ ...prev, orientacoes_paciente: e.target.value }))}
                  placeholder="Instruções e recomendações dadas..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Próximo Retorno</Label>
                <Input
                  type="date"
                  value={formData.proximo_retorno}
                  onChange={(e) => setFormData(prev => ({ ...prev, proximo_retorno: e.target.value }))}
                  className="h-10"
                />
                <p className="text-xs text-gray-500">Se preenchido, um lembrete será criado automaticamente.</p>
              </div>

              <div className="space-y-2">
                <Label>Observações Internas</Label>
                <Textarea
                  value={formData.observacoes_internas}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes_internas: e.target.value }))}
                  placeholder="Notas internas da equipe..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                  ) : (
                    'Salvar Registro'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
