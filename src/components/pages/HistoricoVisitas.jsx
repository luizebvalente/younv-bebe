import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  History,
  Plus,
  DollarSign,
  Calendar,
  TrendingUp,
  User,
  UserPlus,
  Download,
  Stethoscope,
  Clock,
  MapPin,
  Trash2,
  Edit,
  RefreshCw,
  Activity,
  Tag
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import firebaseDataService from '@/services/firebaseDataService'
import { TIPOS_VISITA, STATUS_VISITA, parseLocalDate } from '@/constants/crm'

/**
 * 📋 COMPONENTE DE HISTÓRICO DE VISITAS/PASSAGENS DO PACIENTE
 * 
 * Funcionalidades:
 * - Lista completa de visitas/passagens do paciente na clínica
 * - Estatísticas: média de dias entre visitas, total de visitas, primeiro e último contato
 * - Registro de novas visitas com médico, procedimento, valor, observações
 * - Exportação para CSV
 * - Badge de quantidade de passagens
 * 
 * Props:
 * @param {string} pacienteId - ID do paciente/lead
 * @param {object} paciente - Dados completos do paciente
 * @param {function} onUpdate - Callback para atualizar os dados do lead após mudança
 * @param {ReactNode} trigger - Elemento customizado para abrir o diálogo (opcional)
 */
export default function HistoricoVisitas({ pacienteId, paciente, onUpdate, trigger }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [historico, setHistorico] = useState([])
  const [isAddingVisita, setIsAddingVisita] = useState(false)
  const [editingVisita, setEditingVisita] = useState(null)

  // Dados auxiliares
  const [medicos, setMedicos] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [procedimentos, setProcedimentos] = useState([])
  const [allTags, setAllTags] = useState([])
  const [tagSearchTerm, setTagSearchTerm] = useState('')

  const { user } = useAuth()

  // Formulário de nova visita
  const [visitaForm, setVisitaForm] = useState({
    data_visita: new Date().toISOString().split('T')[0],
    medico_id: '',
    especialidade_id: '',
    procedimento_id: '',
    tipo_visita: 'Consulta',
    valor: '',
    local: '',
    observacoes: '',
    status: 'Realizada',
    tags: []
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, pacienteId])

  const loadData = async () => {
    try {
      setLoading(true)

      // Carregar dados auxiliares
      const [medicosData, especialidadesData, procedimentosData, tagsData] = await Promise.all([
        firebaseDataService.getAll('medicos'),
        firebaseDataService.getAll('especialidades'),
        firebaseDataService.getAll('procedimentos'),
        firebaseDataService.getAll('tags')
      ])

      setMedicos(medicosData)
      setEspecialidades(especialidadesData)
      setProcedimentos(procedimentosData)
      setAllTags(tagsData)

      // Sempre buscar dados frescos do Firebase para garantir que temos a versão mais atual
      if (pacienteId) {
        const pacienteData = await firebaseDataService.getById('leads', pacienteId)
        if (pacienteData?.historico_visitas && Array.isArray(pacienteData.historico_visitas)) {
          setHistorico(pacienteData.historico_visitas)
        } else {
          setHistorico([])
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      // parseLocalDate: 'YYYY-MM-DD' interpretado como data LOCAL
      // (new Date('YYYY-MM-DD') é UTC e exibia a visita 1 dia antes no Brasil)
      const date = parseLocalDate(dateString)
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return '-'
    }
  }

  const formatDateTime = (dateString) => {
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

  const getMedicoNome = (id) => {
    const medico = medicos.find(m => m.id === id)
    return medico ? medico.nome : 'N/A'
  }

  const getEspecialidadeNome = (id) => {
    const especialidade = especialidades.find(e => e.id === id)
    return especialidade ? especialidade.nome : 'N/A'
  }

  const getProcedimentoNome = (id) => {
    const procedimento = procedimentos.find(p => p.id === id)
    return procedimento ? procedimento.nome : 'N/A'
  }

  const resetForm = () => {
    setVisitaForm({
      data_visita: new Date().toISOString().split('T')[0],
      medico_id: '',
      especialidade_id: '',
      procedimento_id: '',
      tipo_visita: 'Consulta',
      valor: '',
      local: '',
      observacoes: '',
      status: 'Realizada',
      tags: []
    })
    setTagSearchTerm('')
    setIsAddingVisita(false)
    setEditingVisita(null)
  }

  const handleSaveVisita = async () => {
    try {
      setSaving(true)

      const userInfo = user ? {
        id: user.uid,
        nome: user.displayName || user.email,
        email: user.email
      } : {
        id: 'sistema',
        nome: 'Sistema',
        email: 'sistema@younv.com'
      }

      const novaVisita = {
        // Sufixo aleatório evita colisão de id (dois saves no mesmo milissegundo)
        id: editingVisita?.id || `visita_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        data_visita: visitaForm.data_visita,
        medico_id: visitaForm.medico_id,
        medico_nome: getMedicoNome(visitaForm.medico_id),
        especialidade_id: visitaForm.especialidade_id,
        especialidade_nome: getEspecialidadeNome(visitaForm.especialidade_id),
        procedimento_id: visitaForm.procedimento_id,
        procedimento_nome: getProcedimentoNome(visitaForm.procedimento_id),
        tipo_visita: visitaForm.tipo_visita,
        valor: parseFloat(visitaForm.valor) || 0,
        local: visitaForm.local,
        observacoes: visitaForm.observacoes,
        tags: visitaForm.tags || [],
        status: visitaForm.status,
        registrado_por_id: userInfo.id,
        registrado_por_nome: userInfo.nome,
        data_registro: editingVisita?.data_registro || new Date().toISOString(),
        data_ultima_alteracao: new Date().toISOString()
      }

      let novoHistorico
      if (editingVisita) {
        // Editando visita existente
        novoHistorico = historico.map(v => v.id === editingVisita.id ? novaVisita : v)
      } else {
        // Adicionando nova visita
        novoHistorico = [...historico, novaVisita]
      }

      // Ordenar por data mais recente
      novoHistorico.sort((a, b) => new Date(b.data_visita) - new Date(a.data_visita))

      // Calcular estatísticas de recorrência
      const primeiraVisita = novoHistorico[novoHistorico.length - 1]?.data_visita
      const ultimaVisita = novoHistorico[0]?.data_visita
      const totalVisitas = novoHistorico.length
      const valorTotalVisitas = novoHistorico.reduce((sum, v) => sum + (parseFloat(v.valor) || 0), 0)

      // Calcular média de dias entre visitas
      let mediaDiasEntreVisitas = 0
      if (novoHistorico.length > 1) {
        let totalDias = 0
        for (let i = 0; i < novoHistorico.length - 1; i++) {
          const dataAtual = new Date(novoHistorico[i].data_visita)
          const dataAnterior = new Date(novoHistorico[i + 1].data_visita)
          totalDias += Math.abs((dataAtual - dataAnterior) / (1000 * 60 * 60 * 24))
        }
        mediaDiasEntreVisitas = Math.round(totalDias / (novoHistorico.length - 1))
      }

      // Calcular recorrencia por especialidade
      const visitasPorEspecialidade = {}
      novoHistorico.forEach(v => {
        const espId = v.especialidade_id || 'sem_especialidade'
        visitasPorEspecialidade[espId] = (visitasPorEspecialidade[espId] || 0) + 1
      })

      // Buscar dados atuais do paciente para somar consumo de produtos
      const pacienteAtual = await firebaseDataService.getById('leads', pacienteId)
      const totalGastoProdutos = pacienteAtual?.total_gasto_produtos || 0
      const valorTotalGasto = valorTotalVisitas + totalGastoProdutos

      // Atualizar o lead com o novo histórico e estatísticas
      await firebaseDataService.update('leads', pacienteId, {
        historico_visitas: novoHistorico,
        total_visitas: totalVisitas,
        primeira_visita: primeiraVisita,
        ultima_visita: ultimaVisita,
        valor_total_visitas: valorTotalVisitas,
        media_dias_entre_visitas: mediaDiasEntreVisitas,
        // Total gasto consolidado (visitas + produtos)
        valor_total_gasto: valorTotalGasto,
        // Atualizar tipo de visita automaticamente se for mais de uma visita
        tipo_visita: totalVisitas > 1 ? 'Recorrente' : 'Primeira Visita',
        visitas_por_especialidade: visitasPorEspecialidade
      })

      setHistorico(novoHistorico)
      resetForm()

      // Recarregar dados do Firebase para garantir consistência
      await loadData()

      if (onUpdate) {
        onUpdate()
      }

      alert(editingVisita ? '✅ Visita atualizada com sucesso!' : '✅ Visita registrada com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar visita:', error)
      alert('Erro ao salvar visita: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEditVisita = (visita) => {
    setEditingVisita(visita)
    setVisitaForm({
      data_visita: visita.data_visita || '',
      medico_id: visita.medico_id || '',
      especialidade_id: visita.especialidade_id || '',
      procedimento_id: visita.procedimento_id || '',
      tipo_visita: visita.tipo_visita || 'Consulta',
      valor: visita.valor?.toString() || '',
      local: visita.local || '',
      observacoes: visita.observacoes || '',
      status: visita.status || 'Realizada',
      tags: visita.tags || []
    })
    setIsAddingVisita(true)
  }

  const handleDeleteVisita = async (visitaId) => {
    if (!confirm('Tem certeza que deseja excluir esta visita?')) return

    try {
      setSaving(true)

      const novoHistorico = historico.filter(v => v.id !== visitaId)

      // Recalcular estatísticas
      const primeiraVisita = novoHistorico[novoHistorico.length - 1]?.data_visita || null
      const ultimaVisita = novoHistorico[0]?.data_visita || null
      const totalVisitas = novoHistorico.length
      const valorTotalVisitas = novoHistorico.reduce((sum, v) => sum + (parseFloat(v.valor) || 0), 0)

      let mediaDiasEntreVisitas = 0
      if (novoHistorico.length > 1) {
        let totalDias = 0
        for (let i = 0; i < novoHistorico.length - 1; i++) {
          const dataAtual = new Date(novoHistorico[i].data_visita)
          const dataAnterior = new Date(novoHistorico[i + 1].data_visita)
          totalDias += Math.abs((dataAtual - dataAnterior) / (1000 * 60 * 60 * 24))
        }
        mediaDiasEntreVisitas = Math.round(totalDias / (novoHistorico.length - 1))
      }

      // Recalcular recorrência por especialidade (antes só o save recalculava —
      // excluir a única visita de uma especialidade deixava a contagem antiga para sempre)
      const visitasPorEspecialidadeDel = {}
      novoHistorico.forEach(v => {
        const espId = v.especialidade_id || 'sem_especialidade'
        visitasPorEspecialidadeDel[espId] = (visitasPorEspecialidadeDel[espId] || 0) + 1
      })

      // Buscar dados atuais do paciente para somar consumo de produtos
      const pacienteAtualDel = await firebaseDataService.getById('leads', pacienteId)
      const totalGastoProdutosDel = pacienteAtualDel?.total_gasto_produtos || 0
      const valorTotalGastoDel = valorTotalVisitas + totalGastoProdutosDel

      await firebaseDataService.update('leads', pacienteId, {
        historico_visitas: novoHistorico,
        total_visitas: totalVisitas,
        primeira_visita: primeiraVisita,
        ultima_visita: ultimaVisita,
        valor_total_visitas: valorTotalVisitas,
        media_dias_entre_visitas: mediaDiasEntreVisitas,
        valor_total_gasto: valorTotalGastoDel,
        tipo_visita: totalVisitas > 1 ? 'Recorrente' : totalVisitas === 1 ? 'Primeira Visita' : '',
        visitas_por_especialidade: visitasPorEspecialidadeDel
      })

      setHistorico(novoHistorico)

      // Recarregar dados do Firebase para garantir consistência
      await loadData()

      if (onUpdate) {
        onUpdate()
      }

      alert('✅ Visita excluída com sucesso!')
    } catch (error) {
      console.error('Erro ao excluir visita:', error)
      alert('Erro ao excluir visita: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const exportToCSV = () => {
    if (!historico || historico.length === 0) {
      alert('Nenhum dado para exportar')
      return
    }

    const headers = [
      'Data da Visita',
      'Tipo',
      'Médico',
      'Especialidade',
      'Procedimento',
      'Valor',
      'Local',
      'Status',
      'Tags',
      'Observações',
      'Registrado Por',
      'Data Registro'
    ]

    const csvContent = [
      headers.join(','),
      ...historico.map(item => {
        const tagNames = (item.tags || [])
          .map(tagId => {
            const tag = allTags.find(t => t.id === tagId)
            return tag ? tag.nome : ''
          })
          .filter(Boolean)
          .join(', ')
        return [
          `"${formatDate(item.data_visita)}"`,
          `"${item.tipo_visita || ''}"`,
          `"${item.medico_nome || ''}"`,
          `"${item.especialidade_nome || ''}"`,
          `"${item.procedimento_nome || ''}"`,
          `"${formatCurrency(item.valor || 0)}"`,
          `"${item.local || ''}"`,
          `"${item.status || ''}"`,
          `"${tagNames}"`,
          `"${item.observacoes || ''}"`,
          `"${item.registrado_por_nome || ''}"`,
          `"${formatDateTime(item.data_registro)}"`
        ].join(',')
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `historico_visitas_${paciente?.nome_paciente?.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Estatísticas calculadas
  const estatisticas = useMemo(() => {
    if (!historico || historico.length === 0) {
      return {
        total: 0,
        valorTotal: 0,
        ticketMedio: 0,
        primeiraVisita: null,
        ultimaVisita: null,
        diasDesdeUltimaVisita: 0,
        diasDesdePrimeiraVisita: 0,
        mediaDiasEntreVisitas: 0
      }
    }

    const sortedHistorico = [...historico].sort((a, b) => new Date(a.data_visita) - new Date(b.data_visita))
    const primeiraVisita = sortedHistorico[0]?.data_visita
    const ultimaVisita = sortedHistorico[sortedHistorico.length - 1]?.data_visita
    const valorTotal = historico.reduce((sum, v) => sum + (parseFloat(v.valor) || 0), 0)

    const hoje = new Date()
    const diasDesdeUltimaVisita = ultimaVisita
      ? Math.floor((hoje - new Date(ultimaVisita)) / (1000 * 60 * 60 * 24))
      : 0
    const diasDesdePrimeiraVisita = primeiraVisita
      ? Math.floor((hoje - new Date(primeiraVisita)) / (1000 * 60 * 60 * 24))
      : 0

    let mediaDiasEntreVisitas = 0
    if (sortedHistorico.length > 1) {
      let totalDias = 0
      for (let i = 0; i < sortedHistorico.length - 1; i++) {
        const dataAtual = new Date(sortedHistorico[i + 1].data_visita)
        const dataAnterior = new Date(sortedHistorico[i].data_visita)
        totalDias += Math.abs((dataAtual - dataAnterior) / (1000 * 60 * 60 * 24))
      }
      mediaDiasEntreVisitas = Math.round(totalDias / (sortedHistorico.length - 1))
    }

    return {
      total: historico.length,
      valorTotal,
      ticketMedio: historico.length > 0 ? valorTotal / historico.length : 0,
      primeiraVisita,
      ultimaVisita,
      diasDesdeUltimaVisita,
      diasDesdePrimeiraVisita,
      mediaDiasEntreVisitas
    }
  }, [historico])

  // Agrupar visitas por médico
  const visitasPorMedico = useMemo(() => {
    const agrupado = {}
    historico.forEach(visita => {
      const medicoNome = visita.medico_nome || 'Não Informado'
      if (!agrupado[medicoNome]) {
        agrupado[medicoNome] = { nome: medicoNome, quantidade: 0, valorTotal: 0 }
      }
      agrupado[medicoNome].quantidade++
      agrupado[medicoNome].valorTotal += visita.valor || 0
    })
    return Object.values(agrupado).sort((a, b) => b.quantidade - a.quantidade).slice(0, 5)
  }, [historico])

  const getStatusColor = (status) => {
    const colors = {
      'Realizada': 'bg-green-100 text-green-800',
      'Agendada': 'bg-blue-100 text-blue-800',
      'Cancelada': 'bg-red-100 text-red-800',
      'Faltou': 'bg-orange-100 text-orange-800',
      'Remarcada': 'bg-yellow-100 text-yellow-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

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
          className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
        >
          <History className="h-4 w-4 mr-2" />
          Histórico de Visitas
          {(paciente?.total_visitas || historico.length) > 0 && (
            <Badge className="ml-2 bg-purple-600 text-white">
              {paciente?.total_visitas || historico.length}
            </Badge>
          )}
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="!max-w-[90vw] max-h-[95vh] overflow-y-auto p-6 w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <History className="h-6 w-6 text-purple-600" />
              Histórico de Visitas e Passagens
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
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
            </div>
          ) : (
            <div className="space-y-6 mt-4">
              {/* Botão Adicionar Nova Visita */}
              <div className="flex justify-end gap-2">
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  disabled={historico.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
                <Button
                  onClick={() => {
                    resetForm()
                    setIsAddingVisita(true)
                  }}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Nova Visita
                </Button>
              </div>

              {/* Cards de Estatísticas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Total de Visitas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600">
                      {estatisticas.total}
                    </div>
                    <p className="text-xs text-purple-500 mt-1">passagens registradas</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Valor Total em Visitas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(estatisticas.valorTotal)}
                    </div>
                    <p className="text-xs text-green-500 mt-1">
                      Ticket médio: {formatCurrency(estatisticas.ticketMedio)}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Total Gasto pelo Paciente
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">
                      {formatCurrency((paciente?.valor_total_gasto) || (estatisticas.valorTotal + (paciente?.total_gasto_produtos || 0)))}
                    </div>
                    <p className="text-xs text-emerald-500 mt-1">
                      visitas + produtos consumidos
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Frequência de Visitas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {estatisticas.mediaDiasEntreVisitas > 0
                        ? `${estatisticas.mediaDiasEntreVisitas} dias`
                        : 'N/A'
                      }
                    </div>
                    <p className="text-xs text-blue-500 mt-1">média entre visitas</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Última Visita
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-semibold text-orange-600">
                      {estatisticas.ultimaVisita ? formatDate(estatisticas.ultimaVisita) : 'N/A'}
                    </div>
                    <p className="text-xs text-orange-500 mt-1">
                      {estatisticas.diasDesdeUltimaVisita > 0
                        ? `há ${estatisticas.diasDesdeUltimaVisita} dias`
                        : estatisticas.ultimaVisita ? 'hoje' : ''
                      }
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Timeline Completa da Jornada do Paciente */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    Jornada do Paciente
                  </CardTitle>
                  <CardDescription>
                    Rastreamento completo desde o primeiro contato até as visitas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Timeline Visual */}
                  <div className="relative">
                    {/* Linha central */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 via-purple-400 to-purple-600"></div>

                    {/* Eventos da Timeline */}
                    <div className="space-y-6">
                      {/* Criação do Lead - Primeiro Contato */}
                      <div className="flex items-start gap-4 relative">
                        <div className="relative z-10 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-lg border-2 border-white">
                          <UserPlus className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-blue-800">📝 Lead Criado - Primeiro Contato</p>
                              <p className="text-sm text-blue-600">
                                {formatDate(paciente?.data_registro_contato || paciente?.createdAt)}
                              </p>
                              {paciente?.criado_por_nome && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Registrado por: {paciente.criado_por_nome}
                                </p>
                              )}
                            </div>
                            <Badge className="bg-blue-100 text-blue-800">Entrada</Badge>
                          </div>
                        </div>
                      </div>

                      {/* Visitas em ordem cronológica */}
                      {[...historico]
                        .sort((a, b) => new Date(a.data_visita) - new Date(b.data_visita))
                        .map((visita, index) => (
                          <div key={visita.id} className="flex items-start gap-4 relative">
                            <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${index === historico.length - 1
                              ? 'bg-purple-600'
                              : 'bg-purple-400'
                              }`}>
                              <span className="text-white text-xs font-bold">{index + 1}</span>
                            </div>
                            <div className={`flex-1 rounded-lg p-4 border ${index === historico.length - 1
                              ? 'bg-purple-50 border-purple-200'
                              : 'bg-gray-50 border-gray-200'
                              }`}>
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                  <p className={`font-semibold ${index === historico.length - 1 ? 'text-purple-800' : 'text-gray-800'
                                    }`}>
                                    {index === 0 ? '🎯 ' : ''}{visita.tipo_visita || 'Visita'} #{index + 1}
                                    {index === historico.length - 1 && historico.length > 1 && ' (Mais Recente)'}
                                  </p>
                                  <p className={`text-sm ${index === historico.length - 1 ? 'text-purple-600' : 'text-gray-600'
                                    }`}>
                                    {formatDate(visita.data_visita)}
                                  </p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {visita.medico_nome && (
                                      <span className="text-xs bg-white px-2 py-1 rounded border">
                                        👨‍⚕️ {visita.medico_nome}
                                      </span>
                                    )}
                                    {visita.procedimento_nome && (
                                      <span className="text-xs bg-white px-2 py-1 rounded border">
                                        💉 {visita.procedimento_nome}
                                      </span>
                                    )}
                                    {visita.valor > 0 && (
                                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                        {formatCurrency(visita.valor)}
                                      </span>
                                    )}
                                  </div>
                                  {visita.tags && visita.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {visita.tags.map(tagId => {
                                        const tag = allTags.find(t => t.id === tagId)
                                        if (!tag) return null
                                        return (
                                          <span
                                            key={tagId}
                                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                                            style={{ backgroundColor: tag.cor || '#6b7280' }}
                                          >
                                            {tag.nome}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                                <Badge className={getStatusColor(visita.status)}>
                                  {visita.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}

                      {/* Indicador de dias sem visita se última visita foi há mais de 30 dias */}
                      {estatisticas.diasDesdeUltimaVisita > 30 && (
                        <div className="flex items-start gap-4 relative">
                          <div className="relative z-10 w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center shadow-lg border-2 border-white">
                            <Clock className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-orange-800">⏰ Sem visitas recentes</p>
                                <p className="text-sm text-orange-600">
                                  Última visita há {estatisticas.diasDesdeUltimaVisita} dias
                                </p>
                              </div>
                              <Badge className="bg-orange-100 text-orange-800">Atenção</Badge>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumo */}
                  <div className="mt-6 pt-4 border-t flex items-center justify-between text-sm text-gray-500">
                    <span>
                      📅 {estatisticas.diasDesdePrimeiraVisita || 0} dias desde o primeiro contato
                    </span>
                    <span>
                      🔄 {estatisticas.total} visitas realizadas
                    </span>
                    {estatisticas.mediaDiasEntreVisitas > 0 && (
                      <span>
                        ⏱️ Média de {estatisticas.mediaDiasEntreVisitas} dias entre visitas
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Top Médicos mais visitados */}
              {visitasPorMedico.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Stethoscope className="h-5 w-5" />
                      Médicos Mais Visitados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {visitasPorMedico.map((medico, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-purple-100 text-purple-800">
                              #{index + 1}
                            </Badge>
                            <div>
                              <p className="font-medium text-sm">{medico.nome}</p>
                              <p className="text-xs text-gray-600">
                                {medico.quantidade} visita(s)
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600 text-sm">
                              {formatCurrency(medico.valorTotal)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Formulário de Nova Visita */}
              {isAddingVisita && (
                <Card className="border-2 border-purple-300 bg-purple-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Plus className="h-5 w-5 text-purple-600" />
                      {editingVisita ? 'Editar Visita' : 'Registrar Nova Visita'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Data da Visita *</label>
                        <Input
                          type="date"
                          value={visitaForm.data_visita}
                          onChange={(e) => setVisitaForm({ ...visitaForm, data_visita: e.target.value })}
                          className="bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tipo de Visita</label>
                        <Select
                          value={visitaForm.tipo_visita}
                          onValueChange={(value) => setVisitaForm({ ...visitaForm, tipo_visita: value })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS_VISITA.map(tipo => (
                              <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Médico</label>
                        <Select
                          value={visitaForm.medico_id}
                          onValueChange={(value) => setVisitaForm({ ...visitaForm, medico_id: value })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecione o médico" />
                          </SelectTrigger>
                          <SelectContent>
                            {medicos.map((medico) => (
                              <SelectItem key={medico.id} value={medico.id}>
                                {medico.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Especialidade</label>
                        <Select
                          value={visitaForm.especialidade_id}
                          onValueChange={(value) => setVisitaForm({ ...visitaForm, especialidade_id: value })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {especialidades.map((especialidade) => (
                              <SelectItem key={especialidade.id} value={especialidade.id}>
                                {especialidade.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Procedimento</label>
                        <Select
                          value={visitaForm.procedimento_id}
                          onValueChange={(value) => setVisitaForm({ ...visitaForm, procedimento_id: value })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {procedimentos
                              .filter(p => !visitaForm.especialidade_id || !p.especialidade_id || p.especialidade_id === visitaForm.especialidade_id)
                              .map((procedimento) => (
                              <SelectItem key={procedimento.id} value={procedimento.id}>
                                {procedimento.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Valor (R$)</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={visitaForm.valor}
                          onChange={(e) => setVisitaForm({ ...visitaForm, valor: e.target.value })}
                          className="bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Local</label>
                        <Input
                          placeholder="Clínica, Hospital, etc."
                          value={visitaForm.local}
                          onChange={(e) => setVisitaForm({ ...visitaForm, local: e.target.value })}
                          className="bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Status</label>
                        <Select
                          value={visitaForm.status}
                          onValueChange={(value) => setVisitaForm({ ...visitaForm, status: value })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_VISITA.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 md:col-span-2 lg:col-span-4">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Tag className="h-4 w-4 text-blue-600" />
                          Tags da Visita
                        </label>
                        {/* Tags selecionadas */}
                        {visitaForm.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {visitaForm.tags.map(tagId => {
                              const tag = allTags.find(t => t.id === tagId)
                              if (!tag) return null
                              return (
                                <span
                                  key={tagId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                  style={{ backgroundColor: tag.cor || '#6b7280' }}
                                >
                                  {tag.nome}
                                  <button
                                    type="button"
                                    onClick={() => setVisitaForm(prev => ({
                                      ...prev,
                                      tags: prev.tags.filter(id => id !== tagId)
                                    }))}
                                    className="ml-1 hover:opacity-75"
                                  >
                                    ×
                                  </button>
                                </span>
                              )
                            })}
                          </div>
                        )}
                        {/* Busca e selecao de tags */}
                        <input
                          type="text"
                          placeholder="Buscar tags..."
                          value={tagSearchTerm}
                          onChange={(e) => setTagSearchTerm(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border rounded-md bg-white"
                        />
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto mt-1">
                          {allTags
                            .filter(tag =>
                              !visitaForm.tags.includes(tag.id) &&
                              tag.nome.toLowerCase().includes(tagSearchTerm.toLowerCase())
                            )
                            .map(tag => (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => setVisitaForm(prev => ({
                                  ...prev,
                                  tags: [...prev.tags, tag.id]
                                }))}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border hover:opacity-80 transition-opacity"
                              >
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: tag.cor || '#6b7280' }}
                                />
                                {tag.nome}
                              </button>
                            ))
                          }
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-2 lg:col-span-4">
                        <label className="text-sm font-medium">Observações</label>
                        <Textarea
                          placeholder="Observações sobre a visita..."
                          value={visitaForm.observacoes}
                          onChange={(e) => setVisitaForm({ ...visitaForm, observacoes: e.target.value })}
                          rows={2}
                          className="bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                      <Button
                        variant="outline"
                        onClick={resetForm}
                        disabled={saving}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleSaveVisita}
                        disabled={saving || !visitaForm.data_visita}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {saving ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            {editingVisita ? 'Atualizar Visita' : 'Salvar Visita'}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabela de Histórico */}
              {historico.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhuma visita registrada
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Registre as passagens deste paciente na clínica para acompanhar a recorrência.
                  </p>
                  <Button
                    onClick={() => {
                      resetForm()
                      setIsAddingVisita(true)
                    }}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar Primeira Visita
                  </Button>
                </div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Histórico Completo de Visitas</CardTitle>
                    <CardDescription>
                      Todas as {historico.length} passagens deste paciente na clínica
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Médico</TableHead>
                            <TableHead>Especialidade</TableHead>
                            <TableHead>Procedimento</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Local</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historico.map((visita, index) => (
                            <TableRow key={visita.id || index}>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3 text-gray-400" />
                                  {formatDate(visita.data_visita)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {visita.tipo_visita || 'Consulta'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Stethoscope className="h-3 w-3 text-purple-600" />
                                  <span className="font-medium text-sm">{visita.medico_nome || 'N/A'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {visita.especialidade_nome || 'N/A'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {visita.procedimento_nome || 'N/A'}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {formatCurrency(visita.valor)}
                              </TableCell>
                              <TableCell className="text-sm">
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-gray-400" />
                                  {visita.local || 'N/A'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(visita.status)}>
                                  {visita.status || 'Realizada'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditVisita(visita)}
                                    disabled={saving}
                                  >
                                    <Edit className="h-4 w-4 text-blue-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteVisita(visita.id)}
                                    disabled={saving}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
