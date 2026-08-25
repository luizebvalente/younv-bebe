import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookUser, Search, Filter, Users, Calendar, DollarSign, TrendingUp, Loader2, RefreshCw, Save, CheckSquare, Square, ChevronDown, ChevronUp, Trash2, Phone, Tag, ExternalLink, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/AuthContext'
import firebaseDataService from '@/services/firebaseDataService'
import HistoricoVisitas from '@/components/pages/HistoricoVisitas'
import { LEAD_STATUSES, STATUS_COLORS, STATUS_VISITA_COLORS, getOrcamentoBase, getValorOrcadoTotal, parseLocalDate } from '@/constants/crm'

// Busca sem acento: digitar "jose" precisa achar "José"
const semAcento = (texto) =>
  (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Passagens registradas DEPOIS da criação da carteira: só elas medem o resultado
// da campanha de reativação — visitas anteriores não foram fruto dela.
// data_visita é 'YYYY-MM-DD'; comparar como string ISO evita deslize de fuso.
const getPassagensPosCarteira = (lead, dataCriacao) => {
  const corte = String(dataCriacao || '').slice(0, 10)
  if (!corte) return []
  return (lead.historico_visitas || []).filter(
    v => String(v.data_visita || '').slice(0, 10) >= corte
  )
}

const isPassagemConvertida = (visita) =>
  visita?.status === 'Convertido' || visita?.status === 'Convertido Parcial'

// Passagem a destacar na tabela: uma convertida vence a mais recente, porque a
// pergunta da carteira é "quem converteu?" — não "qual foi a última interação?"
const getPassagemDestaque = (passagens) => {
  if (passagens.length === 0) return null
  return (
    passagens.find(isPassagemConvertida) ||
    [...passagens].sort((a, b) => String(b.data_visita || '').localeCompare(String(a.data_visita || '')))[0]
  )
}

export default function GestaoCarteira() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('criar')

  // Data states
  const [leads, setLeads] = useState([])
  const [tags, setTags] = useState([])
  const [medicos, setMedicos] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [carteiras, setCarteiras] = useState([])

  // UI states
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  // Filter states
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [filtroStatus, setFiltroStatus] = useState([])
  const [filtroTags, setFiltroTags] = useState([])
  const [filtroTipoVisita, setFiltroTipoVisita] = useState('')
  const [filtroUltimaPassagem, setFiltroUltimaPassagem] = useState('')
  const [filtroAtivoInativo, setFiltroAtivoInativo] = useState('')
  const [filtroMedico, setFiltroMedico] = useState('')

  // Filtros avançados de recorrência
  const [filtroDiasSemVisita, setFiltroDiasSemVisita] = useState('')
  const [filtroMinVisitas, setFiltroMinVisitas] = useState('')
  const [filtroMaxVisitas, setFiltroMaxVisitas] = useState('')
  const [filtroValorMinGasto, setFiltroValorMinGasto] = useState('')
  const [filtroFollowupPendente, setFiltroFollowupPendente] = useState('')
  const [filtroSemRetorno, setFiltroSemRetorno] = useState(false)

  // Selection states
  const [selectedLeads, setSelectedLeads] = useState([])
  const [nomeCarteira, setNomeCarteira] = useState('')

  // Carteira detail
  const [expandedCarteira, setExpandedCarteira] = useState(null)
  const [carteiraLeads, setCarteiraLeads] = useState([])
  // 'todos' | 'converteu' | 'passou' (retornou sem converter) | 'sem' (não retornou)
  const [filtroPassagemCarteira, setFiltroPassagemCarteira] = useState('todos')
  const [loadingCarteira, setLoadingCarteira] = useState(false)
  const [updatingPerformance, setUpdatingPerformance] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [leadsData, tagsData, medicosData, especialidadesData, carteirasData] = await Promise.all([
        firebaseDataService.getAll('leads'),
        firebaseDataService.getAll('tags'),
        firebaseDataService.getAll('medicos'),
        firebaseDataService.getAll('especialidades'),
        firebaseDataService.getAll('carteiras_gestao')
      ])
      setLeads(leadsData)
      setTags(tagsData)
      setMedicos(medicosData)
      setEspecialidades(especialidadesData)
      setCarteiras(carteirasData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const statusOptions = LEAD_STATUSES

  const toggleStatusFilter = (status) => {
    setFiltroStatus(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    )
  }

  const toggleTagFilter = (tagId) => {
    setFiltroTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    )
  }

  // Deduplicate leads by phone number (keep most recent)
  const uniqueLeads = useMemo(() => {
    const map = new Map()
    const sorted = [...leads].sort((a, b) => new Date(b.data_registro_contato || 0) - new Date(a.data_registro_contato || 0))
    sorted.forEach(lead => {
      const phone = (lead.telefone || '').replace(/\D/g, '')
      const key = phone || lead.id
      if (!map.has(key)) {
        map.set(key, lead)
      }
    })
    return Array.from(map.values())
  }, [leads])

  // Estado dos filtros de categorias automaticas
  const [catMesAniversario, setCatMesAniversario] = useState(new Date().getMonth())
  const [catAnoAniversario, setCatAnoAniversario] = useState(new Date().getFullYear())
  const [catDiasInativo, setCatDiasInativo] = useState(90)
  const [catDiasPreInativo, setCatDiasPreInativo] = useState(45)
  const [catDiasPosConsulta, setCatDiasPosConsulta] = useState(7)
  const [catDiasPosProcedimento, setCatDiasPosProcedimento] = useState(30)
  const [catEspecialidade, setCatEspecialidade] = useState('all')
  const [savingCat, setSavingCat] = useState(null)

  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  // Categorias automaticas de carteira
  const categoriasAutomaticas = useMemo(() => {
    const now = new Date()
    const categories = [
      {
        id: 'aniversariantes',
        nome: `Aniversariantes ${MESES[catMesAniversario]}/${catAnoAniversario}`,
        descricao: `Pacientes com aniversário em ${MESES[catMesAniversario]}`,
        pacientes: [],
        cor: 'bg-pink-100 text-pink-800',
        iconColor: 'text-pink-600'
      },
      {
        id: 'rotina',
        nome: 'Rotina',
        descricao: 'Pacientes com visitas regulares dentro da média',
        pacientes: [],
        cor: 'bg-green-100 text-green-800',
        iconColor: 'text-green-600'
      },
      {
        id: 'preInativo',
        nome: `Pré-Inativo (>${catDiasPreInativo} dias)`,
        descricao: `Sem atividade há mais de ${catDiasPreInativo} dias`,
        pacientes: [],
        cor: 'bg-yellow-100 text-yellow-800',
        iconColor: 'text-yellow-600'
      },
      {
        id: 'inativo',
        nome: `Inativo (>${catDiasInativo} dias)`,
        descricao: `Sem atividade há mais de ${catDiasInativo} dias`,
        pacientes: [],
        cor: 'bg-red-100 text-red-800',
        iconColor: 'text-red-600'
      },
      {
        id: 'posConsulta',
        nome: `Pós-Consulta (${catDiasPosConsulta}d)`,
        descricao: `Atendidos nos últimos ${catDiasPosConsulta} dias`,
        pacientes: [],
        cor: 'bg-blue-100 text-blue-800',
        iconColor: 'text-blue-600'
      },
      {
        id: 'posProcedimento',
        nome: `Pós-Procedimento (${catDiasPosProcedimento}d)`,
        descricao: `Procedimento nos últimos ${catDiasPosProcedimento} dias`,
        pacientes: [],
        cor: 'bg-purple-100 text-purple-800',
        iconColor: 'text-purple-600'
      },
    ]

    const catMap = {}
    categories.forEach(c => { catMap[c.id] = c })

    // uniqueLeads (dedup por telefone) — usar `leads` cru contava o mesmo paciente
    // 2x nas categorias e inflava lista_pacientes/total_pacientes das carteiras automáticas
    uniqueLeads.forEach(lead => {
      // Filtro por especialidade
      if (catEspecialidade !== 'all') {
        const temEspecialidade = lead.especialidade_id === catEspecialidade ||
          (lead.outros_profissionais && lead.outros_profissionais.some(p => p.especialidade_id === catEspecialidade && p.ativo))
        if (!temEspecialidade) return
      }

      // Aniversariantes (parseLocalDate: 'YYYY-MM-DD' como local — nascido dia 1º
      // do mês caía no mês anterior com o parse UTC)
      if (lead.data_nascimento) {
        try {
          const bday = parseLocalDate(lead.data_nascimento)
          if (bday && !isNaN(bday.getTime()) && bday.getMonth() === catMesAniversario) {
            catMap.aniversariantes.pacientes.push(lead)
          }
        } catch (e) {}
      }

      // Classificacao por atividade
      const lastActivity = lead.ultima_visita || lead.data_ultima_alteracao || lead.data_registro_contato
      if (!lastActivity) return
      const lastDate = new Date(lastActivity)
      if (isNaN(lastDate.getTime())) return
      const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24))

      if (daysSince > catDiasInativo) {
        catMap.inativo.pacientes.push(lead)
      } else if (daysSince > catDiasPreInativo) {
        catMap.preInativo.pacientes.push(lead)
      } else {
        catMap.rotina.pacientes.push(lead)
      }

      // Pos-consulta
      if ((lead.status === 'Convertido' || lead.status === 'Confirmado') && daysSince <= catDiasPosConsulta) {
        catMap.posConsulta.pacientes.push(lead)
      }

      // Pos-procedimento
      if (lead.valor_procedimento && parseFloat(lead.valor_procedimento) > 0 && daysSince <= catDiasPosProcedimento) {
        catMap.posProcedimento.pacientes.push(lead)
      }
    })

    return categories
  }, [uniqueLeads, catMesAniversario, catAnoAniversario, catDiasInativo, catDiasPreInativo, catDiasPosConsulta, catDiasPosProcedimento, catEspecialidade])

  // Criar carteira automatica a partir de categoria
  const handleCriarCarteiraAutomatica = async (categoria) => {
    if (categoria.pacientes.length === 0) return
    try {
      setSavingCat(categoria.id)
      const userInfo = firebaseDataService.getCurrentUserInfo()
      const carteiraData = {
        nome_carteira: categoria.nome,
        data_criacao: new Date().toISOString(),
        criado_por_id: userInfo.id || '',
        criado_por_nome: userInfo.nome || '',
        lista_pacientes: categoria.pacientes.map(p => p.id),
        total_pacientes: categoria.pacientes.length,
        filtros_aplicados: { categoria_automatica: categoria.id, especialidade: catEspecialidade },
        status: 'ativa',
        performance: { totalReativados: 0, receitaGerada: 0, dataUltimaAtualizacao: '' }
      }
      await firebaseDataService.create('carteiras_gestao', carteiraData)
      setSuccessMessage(`Carteira "${categoria.nome}" criada com ${categoria.pacientes.length} pacientes!`)
      await loadData()
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      console.error('Erro ao criar carteira automática:', err)
      setError('Erro ao criar carteira automática.')
    } finally {
      setSavingCat(null)
    }
  }

  // Filtered leads based on criteria
  const filteredLeads = useMemo(() => {
    // Busca por nome ou telefone: sem ela era preciso varrer a listagem inteira
    // para achar um paciente e marcá-lo
    const termoBusca = semAcento(buscaPaciente.trim())
    const digitosBusca = buscaPaciente.replace(/\D/g, '')

    return uniqueLeads.filter(lead => {
      if (termoBusca) {
        const nomeCasa = semAcento(lead.nome_paciente).includes(termoBusca)
        const telefoneCasa = digitosBusca.length >= 3 &&
          (lead.telefone || '').replace(/\D/g, '').includes(digitosBusca)
        if (!nomeCasa && !telefoneCasa) return false
      }

      if (filtroStatus.length > 0 && !filtroStatus.includes(lead.status)) return false

      if (filtroTags.length > 0) {
        if (!lead.tags || !filtroTags.some(tagId => lead.tags.includes(tagId))) return false
      }

      if (filtroTipoVisita && filtroTipoVisita !== 'all' && lead.tipo_visita !== filtroTipoVisita) return false

      if (filtroUltimaPassagem) {
        const dataLimite = new Date(filtroUltimaPassagem)
        // Usar a data mais recente de atividade: última visita > última alteração > cadastro
        const dataAtividade = lead.ultima_visita || lead.data_ultima_alteracao || lead.data_registro_contato
        const dataRef = dataAtividade ? new Date(dataAtividade) : null
        if (!dataRef || dataRef >= dataLimite) return false
      }

      if (filtroAtivoInativo && filtroAtivoInativo !== 'all') {
        if (filtroAtivoInativo === 'ativo' && (lead.status === 'Inativo' || lead.status === 'Sem Interação')) return false
        if (filtroAtivoInativo === 'inativo' && lead.status !== 'Inativo' && lead.status !== 'Sem Interação') return false
      }

      if (filtroMedico && filtroMedico !== 'all' && lead.medico_agendado_id !== filtroMedico) return false

      // === FILTROS AVANÇADOS DE RECORRÊNCIA ===

      // Dias sem visita: pacientes inativos há X dias ou mais
      if (filtroDiasSemVisita) {
        const dias = parseInt(filtroDiasSemVisita)
        if (!isNaN(dias)) {
          const dataAtividade = lead.ultima_visita || lead.data_ultima_alteracao || lead.data_registro_contato
          if (!dataAtividade) return false
          const diffMs = Date.now() - new Date(dataAtividade).getTime()
          const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          if (diffDias < dias) return false
        }
      }

      // Mínimo de visitas
      if (filtroMinVisitas) {
        const min = parseInt(filtroMinVisitas)
        if (!isNaN(min) && (lead.total_visitas || 0) < min) return false
      }

      // Máximo de visitas
      if (filtroMaxVisitas) {
        const max = parseInt(filtroMaxVisitas)
        if (!isNaN(max) && (lead.total_visitas || 0) > max) return false
      }

      // Valor mínimo gasto
      if (filtroValorMinGasto) {
        const min = parseFloat(filtroValorMinGasto)
        if (!isNaN(min)) {
          // getOrcamentoBase e não valor_orcado: o orçado agora já inclui as passagens,
          // que valor_total_gasto também conta — somar o total contaria duas vezes
          const totalGasto = (parseFloat(lead.valor_total_gasto) || 0) + (parseFloat(lead.total_gasto_produtos) || 0) + (lead.status === 'Convertido' ? getOrcamentoBase(lead) : 0)
          if (totalGasto < min) return false
        }
      }

      // Follow-up pendente (tem follow-up não realizado)
      if (filtroFollowupPendente && filtroFollowupPendente !== 'all') {
        if (filtroFollowupPendente === 'pendente') {
          const temPendente = (!lead.followup1_realizado) || (!lead.followup2_realizado) || (!lead.followup3_realizado)
          if (!temPendente) return false
        }
        if (filtroFollowupPendente === 'completo') {
          const todosFeitos = lead.followup1_realizado && lead.followup2_realizado && lead.followup3_realizado
          if (!todosFeitos) return false
        }
        if (filtroFollowupPendente === 'nenhum') {
          if (lead.followup1_realizado || lead.followup2_realizado || lead.followup3_realizado) return false
        }
      }

      // Sem retorno: pacientes que já foram convertidos mas não voltaram
      if (filtroSemRetorno) {
        const foiConvertido = lead.status === 'Convertido' || lead.orcamento_fechado === 'Total' || lead.orcamento_fechado === 'Parcial'
        const voltou = (lead.total_visitas || 0) > 1 || lead.tipo_visita === 'Recorrente'
        if (!foiConvertido || voltou) return false
      }

      return true
    })
  }, [uniqueLeads, buscaPaciente, filtroStatus, filtroTags, filtroTipoVisita, filtroUltimaPassagem, filtroAtivoInativo, filtroMedico, filtroDiasSemVisita, filtroMinVisitas, filtroMaxVisitas, filtroValorMinGasto, filtroFollowupPendente, filtroSemRetorno])

  const hasActiveFilters = buscaPaciente.trim() || filtroStatus.length > 0 || filtroTags.length > 0 || filtroTipoVisita || filtroUltimaPassagem || filtroAtivoInativo || filtroMedico || filtroDiasSemVisita || filtroMinVisitas || filtroMaxVisitas || filtroValorMinGasto || filtroFollowupPendente || filtroSemRetorno

  // Pacientes já escolhidos, mesmo os que a busca atual esconde — é o que permite
  // ir montando a carteira nome por nome sem perder de vista quem já entrou
  const pacientesSelecionados = useMemo(
    () => selectedLeads.map(id => uniqueLeads.find(l => l.id === id)).filter(Boolean),
    [selectedLeads, uniqueLeads]
  )

  const todosFiltradosSelecionados = filteredLeads.length > 0 &&
    filteredLeads.every(l => selectedLeads.includes(l.id))

  const toggleLeadSelection = (leadId) => {
    setSelectedLeads(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    )
  }

  // Age só sobre os pacientes visíveis: com uma busca ativa, limpar a seleção
  // inteira descartaria quem foi marcado nas buscas anteriores
  const selectAll = () => {
    const idsVisiveis = filteredLeads.map(l => l.id)
    setSelectedLeads(prev =>
      todosFiltradosSelecionados
        ? prev.filter(id => !idsVisiveis.includes(id))
        : Array.from(new Set([...prev, ...idsVisiveis]))
    )
  }

  const clearFilters = () => {
    setBuscaPaciente('')
    setFiltroStatus([])
    setFiltroTags([])
    setFiltroTipoVisita('')
    setFiltroUltimaPassagem('')
    setFiltroAtivoInativo('')
    setFiltroMedico('')
    setFiltroDiasSemVisita('')
    setFiltroMinVisitas('')
    setFiltroMaxVisitas('')
    setFiltroValorMinGasto('')
    setFiltroFollowupPendente('')
    setFiltroSemRetorno(false)
    // Não limpa a seleção: quem já foi marcado numa busca anterior continua na
    // carteira em montagem. Quem salva a carteira zera a seleção explicitamente.
  }

  // Helper: calcular dias sem atividade de um lead
  const getDiasInativo = (lead) => {
    const dataAtividade = lead.ultima_visita || lead.data_ultima_alteracao || lead.data_registro_contato
    if (!dataAtividade) return null
    const diffMs = Date.now() - new Date(dataAtividade).getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }

  const handleSaveCarteira = async () => {
    if (!nomeCarteira.trim()) {
      setError('Informe um nome para a carteira.')
      return
    }
    if (selectedLeads.length === 0) {
      setError('Selecione pelo menos um paciente.')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const userInfo = firebaseDataService.getCurrentUserInfo()

      const carteiraData = {
        nome_carteira: nomeCarteira,
        data_criacao: new Date().toISOString(),
        criado_por_id: userInfo.id,
        criado_por_nome: userInfo.nome,
        lista_pacientes: selectedLeads,
        total_pacientes: selectedLeads.length,
        filtros_aplicados: {
          status: filtroStatus,
          tags: filtroTags,
          tipoVisita: filtroTipoVisita,
          ultimaPassagem: filtroUltimaPassagem,
          ativoInativo: filtroAtivoInativo,
          medico: filtroMedico
        },
        status: 'ativa',
        performance: {
          totalReativados: 0,
          receitaGerada: 0,
          dataUltimaAtualizacao: ''
        }
      }

      await firebaseDataService.create('carteiras_gestao', carteiraData)
      setSuccessMessage(`Carteira "${nomeCarteira}" salva com ${selectedLeads.length} pacientes!`)
      setNomeCarteira('')
      setSelectedLeads([])
      clearFilters()
      await loadData()

      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      console.error('Erro ao salvar carteira:', err)
      setError('Erro ao salvar carteira. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleExpandCarteira = async (carteira) => {
    if (expandedCarteira === carteira.id) {
      setExpandedCarteira(null)
      setCarteiraLeads([])
      return
    }

    try {
      setLoadingCarteira(true)
      setExpandedCarteira(carteira.id)
      setFiltroPassagemCarteira('todos')

      const allLeads = await firebaseDataService.getAll('leads')
      const leadsCarteira = allLeads.filter(l => carteira.lista_pacientes.includes(l.id))
      setCarteiraLeads(leadsCarteira)
    } catch (err) {
      console.error('Erro ao carregar leads da carteira:', err)
      setError('Erro ao carregar dados da carteira.')
    } finally {
      setLoadingCarteira(false)
    }
  }

  // Resumo de conversão das passagens da carteira aberta, calculado ao vivo dos
  // leads carregados — não depende do clique em "Atualizar Performance"
  const carteiraAberta = carteiras.find(c => c.id === expandedCarteira) || null

  const resumoPassagens = useMemo(() => {
    const vazio = { pacientesConvertidos: 0, pacientesEmAberto: 0, semRetorno: 0, totalPassagens: 0, valorConvertidas: 0 }
    if (!carteiraAberta) return vazio
    const resumo = { ...vazio }
    carteiraLeads.forEach(lead => {
      const passagens = getPassagensPosCarteira(lead, carteiraAberta.data_criacao)
      if (passagens.length === 0) {
        resumo.semRetorno++
        return
      }
      resumo.totalPassagens += passagens.length
      if (passagens.some(isPassagemConvertida)) {
        resumo.pacientesConvertidos++
        resumo.valorConvertidas += passagens
          .filter(isPassagemConvertida)
          .reduce((soma, v) => soma + (parseFloat(v.valor) || 0), 0)
      } else {
        resumo.pacientesEmAberto++
      }
    })
    return resumo
  }, [carteiraLeads, carteiraAberta])

  const carteiraLeadsExibidos = useMemo(() => {
    if (!carteiraAberta || filtroPassagemCarteira === 'todos') return carteiraLeads
    return carteiraLeads.filter(lead => {
      const passagens = getPassagensPosCarteira(lead, carteiraAberta.data_criacao)
      if (filtroPassagemCarteira === 'converteu') return passagens.some(isPassagemConvertida)
      if (filtroPassagemCarteira === 'passou') return passagens.length > 0 && !passagens.some(isPassagemConvertida)
      if (filtroPassagemCarteira === 'sem') return passagens.length === 0
      return true
    })
  }, [carteiraLeads, carteiraAberta, filtroPassagemCarteira])

  const handleUpdatePerformance = async (carteira) => {
    try {
      setUpdatingPerformance(true)
      setError(null)

      const allLeads = await firebaseDataService.getAll('leads')
      const leadsCarteira = allLeads.filter(l => carteira.lista_pacientes.includes(l.id))
      const dataCriacao = new Date(carteira.data_criacao)

      const reativados = leadsCarteira.filter(l => {
        // Passagem registrada depois da criação É reativação — o paciente voltou,
        // independente do campo status do lead ter sido atualizado
        if (getPassagensPosCarteira(l, carteira.data_criacao).length > 0) return true
        if (l.status !== 'Agendado' && l.status !== 'Convertido') return false
        const dataAlteracao = l.data_ultima_alteracao ? new Date(l.data_ultima_alteracao) : null
        return dataAlteracao && dataAlteracao > dataCriacao
      }).length

      const receita = leadsCarteira
        .filter(l => {
          if (l.status !== 'Convertido') return false
          const dataAlteracao = l.data_ultima_alteracao ? new Date(l.data_ultima_alteracao) : null
          return dataAlteracao && dataAlteracao > dataCriacao
        })
        .reduce((sum, l) => sum + (parseFloat(l.valor_orcado) || 0), 0)

      const updatedPerformance = {
        totalReativados: reativados,
        receitaGerada: receita,
        dataUltimaAtualizacao: new Date().toISOString()
      }

      await firebaseDataService.update('carteiras_gestao', carteira.id, {
        performance: updatedPerformance
      })

      setCarteiraLeads(leadsCarteira)
      await loadData()
      setSuccessMessage('Performance atualizada com sucesso!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      console.error('Erro ao atualizar performance:', err)
      setError('Erro ao atualizar performance.')
    } finally {
      setUpdatingPerformance(false)
    }
  }

  const handleDeleteCarteira = async (carteiraId) => {
    if (!confirm('Tem certeza que deseja excluir esta carteira?')) return

    try {
      await firebaseDataService.delete('carteiras_gestao', carteiraId)
      setExpandedCarteira(null)
      await loadData()
      setSuccessMessage('Carteira excluída com sucesso!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      console.error('Erro ao excluir carteira:', err)
      setError('Erro ao excluir carteira.')
    }
  }

  const getTagNome = (tagId) => {
    const tag = tags.find(t => t.id === tagId)
    return tag ? tag.nome : tagId
  }

  const getTagCor = (tagId) => {
    const tag = tags.find(t => t.id === tagId)
    return tag ? tag.cor : '#gray'
  }

  const getMedicoNome = (id) => {
    const medico = medicos.find(m => m.id === id)
    return medico ? medico.nome : 'N/A'
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('pt-BR')
    } catch {
      return 'Data inválida'
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
            <BookUser className="h-8 w-8 text-purple-600" />
            Gestão de Carteira
          </h1>
          <p className="text-gray-600 mt-1">Gerencie carteiras de pacientes para ações de reativação</p>
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
          onClick={() => setActiveTab('criar')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'criar' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Criar Carteira
        </button>
        <button
          onClick={() => setActiveTab('minhas')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'minhas' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Minhas Carteiras ({carteiras.length})
        </button>
        <button
          onClick={() => setActiveTab('categorias')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'categorias' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Categorias Automáticas
        </button>
      </div>

      {/* Tab: Criar Carteira */}
      {activeTab === 'criar' && (
        <div className="space-y-6">
          {/* Filtros */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-semibold">
                <Filter className="h-5 w-5 mr-2 text-purple-600" />
                Filtros Avançados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Busca direta pelo paciente */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Buscar Paciente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={buscaPaciente}
                    onChange={(e) => setBuscaPaciente(e.target.value)}
                    placeholder="Digite o nome ou telefone do paciente..."
                    className="h-10 pl-9"
                  />
                  {buscaPaciente && (
                    <button
                      type="button"
                      onClick={() => setBuscaPaciente('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                      title="Limpar busca"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map(status => (
                      <button
                        key={status}
                        onClick={() => toggleStatusFilter(status)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          filtroStatus.includes(status)
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipo de Visita */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tipo de Visita</Label>
                  <Select value={filtroTipoVisita} onValueChange={setFiltroTipoVisita}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Primeira Visita">Primeira Visita</SelectItem>
                      <SelectItem value="Recorrente">Recorrente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Última passagem antes de */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Última passagem antes de</Label>
                  <Input
                    type="date"
                    value={filtroUltimaPassagem}
                    onChange={(e) => setFiltroUltimaPassagem(e.target.value)}
                    className="h-10"
                  />
                </div>

                {/* Ativo/Inativo */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Ativo/Inativo</Label>
                  <Select value={filtroAtivoInativo} onValueChange={setFiltroAtivoInativo}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Médico responsável */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Médico Responsável</Label>
                  <Select value={filtroMedico} onValueChange={setFiltroMedico}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {medicos.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTagFilter(tag.id)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filtroTags.includes(tag.id)
                          ? 'text-white border-transparent'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                      }`}
                      style={filtroTags.includes(tag.id) ? { backgroundColor: tag.cor || '#8b5cf6' } : {}}
                    >
                      {tag.nome}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtros de Recorrência */}
              <div className="space-y-3 pt-3 border-t">
                <Label className="text-sm font-semibold text-purple-700">Filtros de Recorrência</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Dias sem visita (mín.)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 90"
                      value={filtroDiasSemVisita}
                      onChange={e => setFiltroDiasSemVisita(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Mín. visitas</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 2"
                      value={filtroMinVisitas}
                      onChange={e => setFiltroMinVisitas(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Máx. visitas</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 5"
                      value={filtroMaxVisitas}
                      onChange={e => setFiltroMaxVisitas(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Valor mín. gasto (R$)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 500"
                      value={filtroValorMinGasto}
                      onChange={e => setFiltroValorMinGasto(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Follow-up</Label>
                    <Select value={filtroFollowupPendente} onValueChange={setFiltroFollowupPendente}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="completo">Completo</SelectItem>
                        <SelectItem value="nenhum">Sem follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filtroSemRetorno}
                        onCheckedChange={setFiltroSemRetorno}
                      />
                      <span className="text-xs text-gray-600">Convertidos sem retorno</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-gray-500">
                  {filteredLeads.length} pacientes encontrados
                </span>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Nenhum resultado: sem este aviso a tela ficava só com os filtros,
              parecendo que a busca tinha quebrado */}
          {filteredLeads.length === 0 && (
            <Card className="border-0 shadow-lg">
              <CardContent className="text-center py-10">
                <Search className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">
                  {buscaPaciente.trim()
                    ? `Nenhum paciente encontrado para "${buscaPaciente.trim()}".`
                    : 'Nenhum paciente atende aos filtros selecionados.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Results Table */}
          {filteredLeads.length > 0 && (
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    Pacientes ({filteredLeads.length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {todosFiltradosSelecionados ? (
                      <><CheckSquare className="h-4 w-4 mr-1" /> Desmarcar Todos</>
                    ) : (
                      <><Square className="h-4 w-4 mr-1" /> Selecionar Todos</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-3 text-left w-10"></th>
                        <th className="p-3 text-left">Nome</th>
                        <th className="p-3 text-left">Telefone</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-left">Tags</th>
                        <th className="p-3 text-left">Cadastro</th>
                        <th className="p-3 text-left">Última Visita</th>
                        <th className="p-3 text-left">Última Alteração</th>
                        <th className="p-3 text-right">Valor Orçado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map(lead => (
                        <tr key={lead.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-3">
                            <Checkbox
                              checked={selectedLeads.includes(lead.id)}
                              onCheckedChange={() => toggleLeadSelection(lead.id)}
                            />
                          </td>
                          <td className="p-3 font-medium">{lead.nome_paciente}</td>
                          <td className="p-3 text-gray-600">{lead.telefone}</td>
                          <td className="p-3">
                            <Badge className={`text-xs ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-800'}`}>
                              {lead.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {(lead.tags || []).slice(0, 3).map(tagId => (
                                <span
                                  key={tagId}
                                  className="px-2 py-0.5 text-[10px] rounded-full text-white"
                                  style={{ backgroundColor: getTagCor(tagId) }}
                                >
                                  {getTagNome(tagId)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-gray-500 text-xs">{formatDate(lead.data_registro_contato)}</td>
                          <td className="p-3 text-xs">
                            {lead.ultima_visita ? (
                              <span className="text-blue-600 font-medium">{formatDate(lead.ultima_visita)}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            {lead.data_ultima_alteracao ? (
                              <span className="text-gray-600">{formatDate(lead.data_ultima_alteracao)}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-medium">{formatCurrency(getValorOrcadoTotal(lead))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </CardContent>
            </Card>
          )}

          {/* Seleção + salvamento ficam FORA da tabela: presos a ela, sumiam da tela
              junto com os resultados quando a busca não encontrava ninguém, levando
              embora o nome digitado e a visão de quem já estava selecionado */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Carteira em montagem ({selectedLeads.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pacientesSelecionados.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhum paciente selecionado. Use a busca acima para encontrar cada
                  paciente e marque o checkbox para adicioná-lo.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pacientesSelecionados.map(p => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-purple-100 text-purple-800"
                    >
                      {p.nome_paciente || '(sem nome)'}
                      <button
                        type="button"
                        onClick={() => toggleLeadSelection(p.id)}
                        className="ml-1 hover:opacity-70"
                        title="Remover da carteira"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-end gap-4 pt-2 border-t">
                <div className="flex-1 w-full">
                  <Label className="text-sm font-medium mb-2 block">Nome da Carteira</Label>
                  <Input
                    value={nomeCarteira}
                    onChange={(e) => setNomeCarteira(e.target.value)}
                    placeholder="Ex: Pacientes inativos há 90 dias"
                    className="h-10"
                  />
                </div>
                <Button
                  onClick={handleSaveCarteira}
                  disabled={saving || selectedLeads.length === 0 || !nomeCarteira.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Salvar Carteira ({selectedLeads.length} pacientes)</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Minhas Carteiras */}
      {activeTab === 'minhas' && (
        <div className="space-y-4">
          {carteiras.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="text-center py-12">
                <BookUser className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Nenhuma carteira criada ainda.</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('criar')}>
                  Criar Primeira Carteira
                </Button>
              </CardContent>
            </Card>
          ) : (
            carteiras
              .sort((a, b) => new Date(b.data_criacao) - new Date(a.data_criacao))
              .map(carteira => (
                <Card key={carteira.id} className="border-0 shadow-lg">
                  <CardContent className="p-0">
                    {/* Carteira Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleExpandCarteira(carteira)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <BookUser className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{carteira.nome_carteira}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span>{formatDate(carteira.data_criacao)}</span>
                            <span>{carteira.total_pacientes} pacientes</span>
                            <span>por {carteira.criado_por_nome}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm text-gray-500">Reativados</p>
                          <p className="font-semibold text-green-600">{carteira.performance?.totalReativados || 0}</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-sm text-gray-500">Receita</p>
                          <p className="font-semibold text-green-600">{formatCurrency(carteira.performance?.receitaGerada || 0)}</p>
                        </div>
                        {expandedCarteira === carteira.id ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {expandedCarteira === carteira.id && (
                      <div className="border-t p-4 space-y-4">
                        {/* Performance Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-sm text-blue-600 font-medium">Taxa de Reativação</p>
                            <p className="text-2xl font-bold text-blue-900">
                              {carteira.total_pacientes > 0
                                ? ((carteira.performance?.totalReativados || 0) / carteira.total_pacientes * 100).toFixed(1)
                                : 0}%
                            </p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg">
                            <p className="text-sm text-green-600 font-medium">Reativados</p>
                            <p className="text-2xl font-bold text-green-900">{carteira.performance?.totalReativados || 0}</p>
                          </div>
                          <div className="bg-emerald-50 p-4 rounded-lg">
                            <p className="text-sm text-emerald-600 font-medium">Receita Gerada</p>
                            <p className="text-2xl font-bold text-emerald-900">{formatCurrency(carteira.performance?.receitaGerada || 0)}</p>
                          </div>
                          {/* Ao vivo (não depende de "Atualizar Performance"): quem
                              retornou após a criação da carteira converteu a passagem? */}
                          <div className="bg-purple-50 p-4 rounded-lg">
                            <p className="text-sm text-purple-600 font-medium">Conversão de Passagens</p>
                            <p className="text-2xl font-bold text-purple-900">
                              {resumoPassagens.pacientesConvertidos}
                              <span className="text-sm font-medium text-purple-600">
                                {' '}de {resumoPassagens.pacientesConvertidos + resumoPassagens.pacientesEmAberto} que retornaram
                              </span>
                            </p>
                            <p className="text-xs text-purple-500 mt-1">
                              {formatCurrency(resumoPassagens.valorConvertidas)} em passagens convertidas
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdatePerformance(carteira)}
                            disabled={updatingPerformance}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {updatingPerformance ? (
                              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Atualizando...</>
                            ) : (
                              <><RefreshCw className="h-4 w-4 mr-1" /> Atualizar Performance</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteCarteira(carteira.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Excluir
                          </Button>
                        </div>

                        {/* Leads List */}
                        {loadingCarteira ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                            <span className="ml-2 text-gray-500">Carregando pacientes...</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Quem converteu / retornou sem converter / não voltou */}
                            <div className="flex flex-wrap gap-2">
                              {[
                                { valor: 'todos', rotulo: `Todos (${carteiraLeads.length})` },
                                { valor: 'converteu', rotulo: `Converteram (${resumoPassagens.pacientesConvertidos})` },
                                { valor: 'passou', rotulo: `Retornaram sem converter (${resumoPassagens.pacientesEmAberto})` },
                                { valor: 'sem', rotulo: `Não retornaram (${resumoPassagens.semRetorno})` },
                              ].map(opcao => (
                                <button
                                  key={opcao.valor}
                                  onClick={() => setFiltroPassagemCarteira(opcao.valor)}
                                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                    filtroPassagemCarteira === opcao.valor
                                      ? 'bg-purple-600 text-white border-purple-600'
                                      : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                                  }`}
                                >
                                  {opcao.rotulo}
                                </button>
                              ))}
                            </div>

                            <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-gray-50">
                                  <th className="p-3 text-left">Nome</th>
                                  <th className="p-3 text-left">Telefone</th>
                                  <th className="p-3 text-left">Status Atual</th>
                                  <th className="p-3 text-left">Visitas</th>
                                  <th className="p-3 text-left">Passagem pós-carteira</th>
                                  <th className="p-3 text-right">Valor Orçado</th>
                                  <th className="p-3 text-center">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {carteiraLeadsExibidos.map(lead => (
                                  <tr key={lead.id} className="border-b hover:bg-purple-50 transition-colors">
                                    <td
                                      className="p-3 font-medium text-purple-700 cursor-pointer hover:underline"
                                      onClick={() => navigate('/leads', { state: { openLeadId: lead.id } })}
                                      title="Ir para o lead"
                                    >
                                      {lead.nome_paciente}
                                    </td>
                                    <td className="p-3 text-gray-600">{lead.telefone}</td>
                                    <td className="p-3">
                                      <Badge className={`text-xs ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-800'}`}>
                                        {lead.status}
                                      </Badge>
                                    </td>
                                    <td className="p-3 text-gray-600">
                                      {lead.total_visitas || 0} {lead.total_visitas === 1 ? 'visita' : 'visitas'}
                                    </td>
                                    <td className="p-3">
                                      {(() => {
                                        const passagens = getPassagensPosCarteira(lead, carteira.data_criacao)
                                        const destaque = getPassagemDestaque(passagens)
                                        if (!destaque) return <span className="text-gray-400 text-xs">não retornou</span>
                                        return (
                                          <div className="flex items-center gap-2">
                                            <Badge className={`text-xs ${STATUS_COLORS[destaque.status] || STATUS_VISITA_COLORS[destaque.status] || 'bg-gray-100 text-gray-800'}`}>
                                              {destaque.status || '—'}
                                            </Badge>
                                            <span className="text-xs text-gray-500 whitespace-nowrap">
                                              {destaque.data_visita ? parseLocalDate(destaque.data_visita).toLocaleDateString('pt-BR') : ''}
                                              {passagens.length > 1 && ` (+${passagens.length - 1})`}
                                            </span>
                                          </div>
                                        )
                                      })()}
                                    </td>
                                    <td className="p-3 text-right font-medium">{formatCurrency(getValorOrcadoTotal(lead))}</td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 px-2 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                          onClick={() => navigate('/leads', { state: { openLeadId: lead.id } })}
                                          title="Editar lead"
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          Lead
                                        </Button>
                                        <HistoricoVisitas
                                          pacienteId={lead.id}
                                          paciente={lead}
                                          onUpdate={async () => {
                                            await loadData()
                                            if (expandedCarteira) {
                                              const allLeads = await firebaseDataService.getAll('leads')
                                              const updated = allLeads.filter(l => carteira.lista_pacientes.includes(l.id))
                                              setCarteiraLeads(updated)
                                            }
                                          }}
                                          trigger={
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-7 px-2 text-xs bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                                              title="Registrar passagem"
                                            >
                                              <History className="h-3 w-3 mr-1" />
                                              Passagens
                                            </Button>
                                          }
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            </div>
                          </div>
                        )}

                        {carteira.performance?.dataUltimaAtualizacao && (
                          <p className="text-xs text-gray-400 text-right">
                            Última atualização: {formatDate(carteira.performance.dataUltimaAtualizacao)}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
          )}
        </div>
      )}

      {/* Tab: Categorias Automáticas */}
      {activeTab === 'categorias' && (
        <div className="space-y-4">
          {/* Filtros Inteligentes */}
          <Card className="border border-purple-200 bg-purple-50/30">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-purple-800 mb-3">Filtros das Categorias</p>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-medium">Mês Aniversário</label>
                  <Select value={String(catMesAniversario)} onValueChange={(v) => setCatMesAniversario(Number(v))}>
                    <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MESES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-medium">Ano</label>
                  <Select value={String(catAnoAniversario)} onValueChange={(v) => setCatAnoAniversario(Number(v))}>
                    <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2025, 2026, 2027].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-medium">Dias Pré-Inativo</label>
                  <Input type="number" value={catDiasPreInativo} onChange={e => setCatDiasPreInativo(Number(e.target.value) || 45)} className="h-8 text-xs bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-medium">Dias Inativo</label>
                  <Input type="number" value={catDiasInativo} onChange={e => setCatDiasInativo(Number(e.target.value) || 90)} className="h-8 text-xs bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-medium">Dias Pós-Consulta</label>
                  <Input type="number" value={catDiasPosConsulta} onChange={e => setCatDiasPosConsulta(Number(e.target.value) || 7)} className="h-8 text-xs bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-medium">Dias Pós-Proced.</label>
                  <Input type="number" value={catDiasPosProcedimento} onChange={e => setCatDiasPosProcedimento(Number(e.target.value) || 30)} className="h-8 text-xs bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-medium">Especialidade</label>
                  <Select value={catEspecialidade} onValueChange={setCatEspecialidade}>
                    <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {especialidades.filter(e => e.ativo !== false).map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards de Categorias */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoriasAutomaticas.map((cat) => (
              <Card key={cat.id} className="border hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cat.cor}`}>
                      {cat.nome}
                    </span>
                    <span className="text-2xl font-bold">{cat.pacientes.length}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{cat.descricao}</p>

                  {cat.pacientes.length > 0 && (
                    <>
                      <div className="space-y-1 max-h-36 overflow-y-auto mb-3 border-t pt-2">
                        {cat.pacientes.slice(0, 8).map(p => (
                          <div key={p.id} className="text-xs flex justify-between items-center hover:bg-gray-50 px-1 rounded">
                            <span
                              className="truncate text-purple-700 cursor-pointer hover:underline"
                              onClick={() => navigate('/leads', { state: { openLeadId: p.id } })}
                            >
                              {p.nome_paciente}
                            </span>
                            <span className="text-gray-400 flex-shrink-0 ml-2">{p.telefone}</span>
                          </div>
                        ))}
                        {cat.pacientes.length > 8 && (
                          <p className="text-xs text-gray-400 text-center pt-1">+{cat.pacientes.length - 8} mais</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() => handleCriarCarteiraAutomatica(cat)}
                        disabled={savingCat === cat.id}
                      >
                        {savingCat === cat.id ? (
                          <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Criando...</>
                        ) : (
                          <><Save className="h-3 w-3 mr-1" /> Criar Carteira "{cat.nome}"</>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
