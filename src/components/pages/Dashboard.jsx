import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { Users, UserPlus, Calendar, TrendingUp, DollarSign, Target, Activity, Loader2, Zap, Clock, Repeat, Award, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import firebaseDataService from '@/services/firebaseDataService'
import { STATUS_COLORS, isLeadConvertido } from '@/constants/crm'

const Dashboard = () => {
  const [leads, setLeads] = useState([])
  const [medicos, setMedicos] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [procedimentos, setProcedimentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [leadsData, medicosData, especialidadesData, procedimentosData] = await Promise.all([
        firebaseDataService.getAll('leads'),
        firebaseDataService.getAll('medicos'),
        firebaseDataService.getAll('especialidades'),
        firebaseDataService.getAll('procedimentos')
      ])
      
      setLeads(leadsData)
      setMedicos(medicosData)
      setEspecialidades(especialidadesData)
      setProcedimentos(procedimentosData)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
      setError('Erro ao carregar dados do dashboard. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Cálculos para métricas
  // isLeadConvertido: critério ÚNICO de conversão em todas as telas
  // (antes o card "Taxa de Conversão" e o card "Receita" ao lado usavam definições diferentes)
  const totalLeads = leads.length
  const agendados = leads.filter(l => l.agendado).length
  const leadsConvertidos = leads.filter(isLeadConvertido)
  const convertidos = leadsConvertidos.length
  const taxaConversao = totalLeads > 0 ? ((convertidos / totalLeads) * 100).toFixed(1) : 0

  // Total em R$ de conversões (Convertido = valor_orcado; Convertido Parcial = valor_fechado_parcial)
  const valorConversoes = leadsConvertidos.reduce((sum, l) => {
    if (l.orcamento_fechado === 'Parcial') {
      return sum + (parseFloat(l.valor_fechado_parcial) || 0)
    }
    return sum + (parseFloat(l.valor_orcado) || 0)
  }, 0)

  // CORREÇÃO COMPLETA: Função para normalizar data (sem horário)
  const normalizarData = (data) => {
    const d = new Date(data)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  // CORREÇÃO: Cálculo de leads cadastrados hoje - VERSÃO CORRIGIDA
  const leadsHoje = leads.filter(lead => {
    if (!lead.data_registro_contato) return false
    try {
      const hoje = normalizarData(new Date())
      const dataLead = normalizarData(lead.data_registro_contato)
      return hoje.getTime() === dataLead.getTime()
    } catch {
      return false
    }
  }).length

  // CORREÇÃO: Cálculo de leads cadastrados ontem para comparação
  const leadsOntem = leads.filter(lead => {
    if (!lead.data_registro_contato) return false
    
    try {
      const ontem = new Date()
      ontem.setDate(ontem.getDate() - 1)
      const ontemNormalizada = normalizarData(ontem)
      const dataLead = normalizarData(lead.data_registro_contato)
      
      return ontemNormalizada.getTime() === dataLead.getTime()
    } catch (error) {
      console.error('❌ Erro ao processar data do lead para ontem:', lead.data_registro_contato, error)
      return false
    }
  }).length

  // Diferença entre hoje e ontem
  const diferencaHojeOntem = leadsHoje - leadsOntem

  // === MÉTRICAS DE RECORRÊNCIA ===
  // Classificação EXCLUSIVA: novo = não-recorrente. Antes um lead com
  // tipo_visita='Primeira Visita' e total_visitas>1 contava nos DOIS grupos
  // (a soma da pizza passava de 100%).
  const isRecorrente = (l) => l.tipo_visita === 'Recorrente' || (l.total_visitas || 0) > 1
  const leadsRecorrentes = leads.filter(isRecorrente)
  const leadsPrimeiraVez = leads.filter(l => !isRecorrente(l))
  const taxaRecorrencia = totalLeads > 0 ? ((leadsRecorrentes.length / totalLeads) * 100).toFixed(1) : 0

  const convertidosRecorrentes = leadsRecorrentes.filter(isLeadConvertido).length
  const convertidosPrimeiraVez = leadsPrimeiraVez.filter(isLeadConvertido).length
  const taxaConversaoRecorrentes = leadsRecorrentes.length > 0 ? ((convertidosRecorrentes / leadsRecorrentes.length) * 100).toFixed(1) : 0
  const taxaConversaoPrimeiraVez = leadsPrimeiraVez.length > 0 ? ((convertidosPrimeiraVez / leadsPrimeiraVez.length) * 100).toFixed(1) : 0

  const receitaRecorrentes = leadsRecorrentes.reduce((sum, l) => {
    const valorVisitas = Number(l.valor_total_visitas) || 0
    const valorProdutos = Number(l.total_gasto_produtos) || 0
    const valorGasto = Number(l.valor_total_gasto) || (valorVisitas + valorProdutos)
    return sum + (valorGasto > 0 ? valorGasto : (Number(l.valor_orcado) || 0))
  }, 0)

  const receitaPrimeiraVez = leadsPrimeiraVez.reduce((sum, l) => sum + (Number(l.valor_orcado) || 0), 0)

  // === RANKING POR INDICADORES ===
  // Ranking de médicos por volume e conversão
  const rankingMedicos = medicos.map(medico => {
    const medicoLeads = leads.filter(l => l.medico_agendado_id === medico.id)
    const medicoConvertidos = medicoLeads.filter(isLeadConvertido)
    const medicoReceita = medicoConvertidos.reduce((sum, l) => {
      if (l.orcamento_fechado === 'Parcial') return sum + (Number(l.valor_fechado_parcial) || 0)
      return sum + (Number(l.valor_orcado) || 0)
    }, 0)
    return {
      nome: medico.nome,
      totalLeads: medicoLeads.length,
      convertidos: medicoConvertidos.length,
      taxaConversao: medicoLeads.length > 0 ? ((medicoConvertidos.length / medicoLeads.length) * 100).toFixed(1) : '0.0',
      receita: medicoReceita
    }
  }).filter(m => m.totalLeads > 0).sort((a, b) => b.totalLeads - a.totalLeads)

  // Ranking de canais por volume e conversão
  const rankingCanais = (() => {
    const canaisMap = {}
    leads.forEach(lead => {
      const canal = lead.canal_contato || 'Não informado'
      if (!canaisMap[canal]) canaisMap[canal] = { nome: canal, totalLeads: 0, convertidos: 0, receita: 0 }
      canaisMap[canal].totalLeads++
      if (isLeadConvertido(lead)) {
        canaisMap[canal].convertidos++
        canaisMap[canal].receita += lead.orcamento_fechado === 'Parcial' ? (Number(lead.valor_fechado_parcial) || 0) : (Number(lead.valor_orcado) || 0)
      }
    })
    return Object.values(canaisMap).map(c => ({
      ...c,
      taxaConversao: c.totalLeads > 0 ? ((c.convertidos / c.totalLeads) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => b.totalLeads - a.totalLeads)
  })()

  // Ticket Medio Global
  const ticketMedioGlobal = (() => {
    const convertidos = leads.filter(isLeadConvertido)
    if (convertidos.length === 0) return 0
    const totalReceita = convertidos.reduce((sum, l) => {
      const consulta = parseFloat(l.valor_consulta) || 0
      const procedimento = parseFloat(l.valor_procedimento) || 0
      const produtos = parseFloat(l.total_gasto_produtos) || 0
      const orcado = parseFloat(l.valor_orcado) || 0
      return sum + (consulta + procedimento + produtos > 0 ? consulta + procedimento + produtos : orcado)
    }, 0)
    return totalReceita / convertidos.length
  })()

  // Indicadores Operacionais
  const indicadoresOperacionais = (() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const leadsDoMes = leads.filter(l => {
      const date = new Date(l.data_registro_contato)
      return date >= startOfMonth
    })
    return {
      reagendamentos: leadsDoMes.filter(l => l.status === 'Reagendado').length,
      cancelamentos: leadsDoMes.filter(l => l.status === 'Desmarcou').length,
      faltas: leadsDoMes.filter(l => l.status === 'Faltou').length,
      naoAgendou: leadsDoMes.filter(l => l.status === 'Não Agendou').length,
    }
  })()

  // Oxigenacao da Carteira - Novos vs Recorrentes por mes
  const oxigenacaoCarteira = (() => {
    const months = {}
    leads.forEach(lead => {
      const dateStr = lead.data_registro_contato
      if (!dateStr) return
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) months[key] = { mes: key, novos: 0, recorrentes: 0 }
      if (lead.tipo_visita === 'Recorrente' || (lead.total_visitas || 0) > 1) {
        months[key].recorrentes++
      } else {
        months[key].novos++
      }
    })
    return Object.values(months).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12)
  })()

  // Alertas de Abandono
  const alertasAbandono = leads.filter(lead => {
    if ((lead.total_visitas || 0) < 2) return false
    const avg = lead.media_dias_entre_visitas || 30
    const lastVisit = lead.ultima_visita ? new Date(lead.ultima_visita) : null
    if (!lastVisit || isNaN(lastVisit.getTime())) return false
    const daysSince = Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
    return daysSince > avg * 2
  }).length

  // Previsao de Faturamento (media dos ultimos 3 meses)
  const previsaoFaturamento = (() => {
    const now = new Date()
    const months = []
    for (let i = 1; i <= 3; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
      const leadsDoMes = leads.filter(l => {
        const d = new Date(l.data_registro_contato)
        return d >= start && d <= end && isLeadConvertido(l)
      })
      const receita = leadsDoMes.reduce((sum, l) => sum + (parseFloat(l.valor_orcado) || 0), 0)
      months.push(receita)
    }
    const validMonths = months.filter(m => m > 0)
    return validMonths.length > 0 ? validMonths.reduce((a, b) => a + b, 0) / validMonths.length : 0
  })()

  // Dados para gráfico de recorrência
  const dadosRecorrencia = [
    { tipo: 'Primeira Vez', quantidade: leadsPrimeiraVez.length, convertidos: convertidosPrimeiraVez, receita: receitaPrimeiraVez },
    { tipo: 'Recorrentes', quantidade: leadsRecorrentes.length, convertidos: convertidosRecorrentes, receita: receitaRecorrentes }
  ]

  const COLORS_PIE = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

  // Leads recentes (últimos 5) — cópia antes do sort para não mutar o estado no render
  const leadsRecentes = [...leads]
    .sort((a, b) => new Date(b.data_registro_contato) - new Date(a.data_registro_contato))
    .slice(0, 5)

  // Próximos agendamentos (simulado)
  const proximosAgendamentos = leads
    .filter(l => l.agendado && l.status !== 'Convertido')
    .slice(0, 5)

  // Dados para gráfico de leads por canal
  const leadsPorCanal = () => {
    const canais = {}
    leads.forEach(lead => {
      const canal = lead.canal_contato || 'Não informado'
      canais[canal] = (canais[canal] || 0) + 1
    })
    return Object.entries(canais).map(([canal, quantidade]) => ({
      canal,
      quantidade
    }))
  }

  // CORREÇÃO: Dados para gráfico de evolução mensal (ORDENAÇÃO CORRIGIDA)
  const leadsPorMes = () => {
    const meses = {}
    leads.forEach(lead => {
      if (!lead.data_registro_contato) return
      
      try {
        const data = new Date(lead.data_registro_contato)
        const ano = data.getFullYear()
        const mes = data.getMonth() + 1
        const chaveOrdenacao = `${ano}${String(mes).padStart(2, '0')}` // Para ordenação
        const mesAnoDisplay = `${String(mes).padStart(2, '0')}/${ano}` // Para exibição
        
        if (!meses[chaveOrdenacao]) {
          meses[chaveOrdenacao] = {
            mes: mesAnoDisplay,
            quantidade: 0,
            chaveOrdenacao
          }
        }
        meses[chaveOrdenacao].quantidade++
      } catch (error) {
        console.warn('Erro ao processar data para gráfico mensal:', lead.data_registro_contato)
      }
    })
    
    // CORREÇÃO: Ordenar do menor para o maior mês
    return Object.values(meses)
      .sort((a, b) => a.chaveOrdenacao.localeCompare(b.chaveOrdenacao))
      .slice(-6) // Últimos 6 meses
      .map(({ mes, quantidade }) => ({ mes, quantidade }))
  }

  // NOVO: Dados para gráfico de evolução semanal (últimas 4 semanas)
  const leadsPorSemana = () => {
    const hoje = new Date()
    const semanas = []
    
    // Gerar as últimas 4 semanas
    for (let i = 3; i >= 0; i--) {
      const inicioSemana = new Date(hoje)
      inicioSemana.setDate(hoje.getDate() - (i * 7) - hoje.getDay()) // Domingo da semana
      inicioSemana.setHours(0, 0, 0, 0)
      
      const fimSemana = new Date(inicioSemana)
      fimSemana.setDate(inicioSemana.getDate() + 6) // Sábado da semana
      fimSemana.setHours(23, 59, 59, 999)
      
      const leadsNaSemana = leads.filter(lead => {
        if (!lead.data_registro_contato) return false
        
        try {
          const dataLead = new Date(lead.data_registro_contato)
          return dataLead >= inicioSemana && dataLead <= fimSemana
        } catch (error) {
          return false
        }
      }).length
      
      // Formatar label da semana
      const labelSemana = i === 0 ? 'Esta semana' : 
                         i === 1 ? 'Semana passada' : 
                         `${i} semanas atrás`
      
      semanas.push({
        semana: labelSemana,
        quantidade: leadsNaSemana,
        periodo: `${inicioSemana.getDate()}/${inicioSemana.getMonth() + 1} - ${fimSemana.getDate()}/${fimSemana.getMonth() + 1}`
      })
    }
    
    return semanas
  }

  const getMedicoNome = (id) => {
    const medico = medicos.find(m => m.id === id)
    return medico ? medico.nome : 'N/A'
  }

  const getEspecialidadeNome = (id) => {
    const especialidade = especialidades.find(e => e.id === id)
    return especialidade ? especialidade.nome : 'N/A'
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Não informado'
    try {
      return new Date(dateString).toLocaleDateString('pt-BR')
    } catch {
      return 'Data inválida'
    }
  }

  const formatTime = (dateString) => {
    if (!dateString) return 'Não informado'
    
    try {
      const now = new Date()
      const date = new Date(dateString)
      const diffInHours = Math.floor((now - date) / (1000 * 60 * 60))
      
      if (diffInHours < 1) return 'há poucos minutos'
      if (diffInHours < 24) return `há ${diffInHours} horas`
      return `há ${Math.floor(diffInHours / 24)} dias`
    } catch {
      return 'Data inválida'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-600">Carregando dashboard...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Visão geral do seu CRM</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Sistema Online</span>
          <div className="w-2 h-2 bg-blue-500 rounded-full ml-4"></div>
          <span className="text-sm text-gray-600">Firebase Conectado</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">
              Total de Leads
            </CardTitle>
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{totalLeads}</div>
            <p className="text-sm text-gray-600 mt-2 flex items-center">
              <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-green-600 font-medium">Sistema ativo</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">
              Agendamentos
            </CardTitle>
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{agendados}</div>
            <p className="text-sm text-gray-600 mt-2 flex items-center">
              <Calendar className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-green-600 font-medium">Confirmados</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">
              Taxa de Conversão
            </CardTitle>
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{taxaConversao}%</div>
            <p className="text-sm text-gray-600 mt-2 flex items-center">
              <Target className="h-4 w-4 text-purple-600 mr-1" />
              <span className="text-purple-600 font-medium">{convertidos} convertidos</span>
            </p>
          </CardContent>
        </Card>

        {/* Card: Receita de Conversões */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100 hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">
              Receita de Conversões
            </CardTitle>
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(valorConversoes)}
            </div>
            <p className="text-sm text-gray-600 mt-2 flex items-center">
              <TrendingUp className="h-4 w-4 text-emerald-600 mr-1" />
              <span className="text-emerald-600 font-medium">{leadsConvertidos.length} convertidos</span>
            </p>
          </CardContent>
        </Card>

        {/* CARD CORRIGIDO - Leads Hoje */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">
              Leads Hoje
            </CardTitle>
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{leadsHoje}</div>
            <p className="text-sm text-gray-600 mt-2 flex items-center">
              {diferencaHojeOntem >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
              ) : (
                <TrendingUp className="h-4 w-4 text-red-600 mr-1 transform rotate-180" />
              )}
              <span className={`font-medium ${diferencaHojeOntem >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {diferencaHojeOntem >= 0 ? '+' : ''}{diferencaHojeOntem}
              </span> vs ontem ({leadsOntem})
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border border-gray-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Ticket Médio</p>
                    <p className="text-xl font-bold text-cyan-600">
                      R$ {ticketMedioGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border border-gray-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Previsão Mensal</p>
                    <p className="text-xl font-bold text-emerald-600">
                      R$ {previsaoFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-gray-400">Média dos últimos 3 meses</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {alertasAbandono > 0 && (
              <Card className="bg-red-50 shadow-sm border border-red-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-red-700">Alerta de Abandono</p>
                      <p className="text-xl font-bold text-red-600">{alertasAbandono} pacientes</p>
                      <p className="text-xs text-red-500">Sem visita há mais do que o dobro da média</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
      </div>

      {/* Card: Total Investido na Clínica */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100 hover:shadow-xl transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-700">
            Total Investido na Clínica
          </CardTitle>
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">
            {formatCurrency(
              leads.filter(isLeadConvertido).reduce((sum, l) => sum + (Number(l.valor_orcado) || 0), 0) +
              leads.reduce((sum, l) => sum + (Number(l.total_gasto_produtos) || 0), 0)
            )}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {formatCurrency(leads.filter(isLeadConvertido).reduce((sum, l) => sum + (Number(l.valor_orcado) || 0), 0))} em procedimentos + {formatCurrency(leads.reduce((sum, l) => sum + (Number(l.total_gasto_produtos) || 0), 0))} em produtos
          </p>
        </CardContent>
      </Card>

      {/* Charts Section - AMPLIADA PARA 3 GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads por Canal */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-lg font-semibold">
              <Zap className="h-5 w-5 mr-2 text-purple-600" />
              Leads por Canal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leadsPorCanal().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={leadsPorCanal()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="canal" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }} 
                  />
                  <Bar dataKey="quantidade" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>Nenhum dado disponível</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GRÁFICO MENSAL CORRIGIDO */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-lg font-semibold">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
              Evolução Mensal
            </CardTitle>
            <p className="text-sm text-gray-600">Últimos 6 meses</p>
          </CardHeader>
          <CardContent>
            {leadsPorMes().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={leadsPorMes()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="quantidade" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>Nenhum dado disponível</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* NOVO: GRÁFICO SEMANAL */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-lg font-semibold">
              <Clock className="h-5 w-5 mr-2 text-green-600" />
              Evolução Semanal
            </CardTitle>
            <p className="text-sm text-gray-600">Últimas 4 semanas</p>
          </CardHeader>
          <CardContent>
            {leadsPorSemana().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={leadsPorSemana()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="semana" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name, props) => [
                      `${value} leads`,
                      props.payload.periodo
                    ]}
                  />
                  <Bar 
                    dataKey="quantidade" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <div className="text-center">
                  <Clock className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>Nenhum dado disponível</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === SEÇÃO DE RECORRÊNCIA === */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Repeat className="h-5 w-5 text-purple-600" />
          Controle de Recorrência
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Primeira Vez</CardTitle>
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{leadsPrimeiraVez.length}</div>
              <div className="flex items-center mt-2 text-sm">
                <span className="text-blue-600 font-medium">Conversão: {taxaConversaoPrimeiraVez}%</span>
                <span className="ml-2 text-gray-500">({convertidosPrimeiraVez} convertidos)</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Recorrentes</CardTitle>
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                <Repeat className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{leadsRecorrentes.length}</div>
              <div className="flex items-center mt-2 text-sm">
                <span className="text-purple-600 font-medium">Conversão: {taxaConversaoRecorrentes}%</span>
                <span className="ml-2 text-gray-500">({convertidosRecorrentes} convertidos)</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Taxa de Recorrência</CardTitle>
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{taxaRecorrencia}%</div>
              <p className="text-sm text-gray-600 mt-2">
                dos pacientes retornam
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Receita Recorrentes</CardTitle>
              <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(receitaRecorrentes)}</div>
              <p className="text-sm text-gray-600 mt-2">
                1a vez: {formatCurrency(receitaPrimeiraVez)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos de Recorrência */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-semibold">
                <Repeat className="h-5 w-5 mr-2 text-purple-600" />
                Primeira Vez vs Recorrentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dadosRecorrencia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="tipo" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    formatter={(value, name) => {
                      if (name === 'quantidade') return [value, 'Total']
                      if (name === 'convertidos') return [value, 'Convertidos']
                      return [value, name]
                    }}
                  />
                  <Legend />
                  <Bar dataKey="quantidade" fill="#3b82f6" name="Total" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="convertidos" fill="#10b981" name="Convertidos" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-semibold">
                <Target className="h-5 w-5 mr-2 text-emerald-600" />
                Distribuição de Pacientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={dadosRecorrencia}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="quantidade"
                    nameKey="tipo"
                    label={({ tipo, quantidade, percent }) => `${tipo}: ${quantidade} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {dadosRecorrencia.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_PIE[index]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Pacientes']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Indicadores Operacionais */}
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Indicadores Operacionais (Mês Atual)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-amber-50">
                  <p className="text-2xl font-bold text-amber-600">{indicadoresOperacionais.reagendamentos}</p>
                  <p className="text-xs text-amber-700">Reagendamentos</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50">
                  <p className="text-2xl font-bold text-red-600">{indicadoresOperacionais.cancelamentos}</p>
                  <p className="text-xs text-red-700">Cancelamentos</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-orange-50">
                  <p className="text-2xl font-bold text-orange-600">{indicadoresOperacionais.faltas}</p>
                  <p className="text-xs text-orange-700">Faltas</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-2xl font-bold text-gray-600">{indicadoresOperacionais.naoAgendou}</p>
                  <p className="text-xs text-gray-700">Não Agendou</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Oxigenação da Carteira */}
          {oxigenacaoCarteira.length > 0 && (
            <Card className="bg-white shadow-sm border border-gray-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Oxigenação da Carteira (Novos vs Recorrentes)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={oxigenacaoCarteira}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="novos" name="Novos" fill="#3b82f6" stackId="a" />
                      <Bar dataKey="recorrentes" name="Recorrentes" fill="#8b5cf6" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

      {/* === RANKING DE INDICADORES === */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-600" />
          Ranking de Indicadores
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ranking de Médicos */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-semibold">
                <Users className="h-5 w-5 mr-2 text-purple-600" />
                Performance por Médico
              </CardTitle>
              <p className="text-sm text-gray-500">Ranking por volume de leads e conversão</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rankingMedicos.slice(0, 8).map((medico, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{medico.nome}</p>
                        <p className="text-xs text-gray-500">{medico.totalLeads} leads</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${
                          parseFloat(medico.taxaConversao) >= 50 ? 'bg-green-100 text-green-800' :
                          parseFloat(medico.taxaConversao) >= 30 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {medico.taxaConversao}% conv.
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-green-600 mt-1">{formatCurrency(medico.receita)}</p>
                    </div>
                  </div>
                ))}
                {rankingMedicos.length === 0 && (
                  <p className="text-center text-gray-500 py-4">Nenhum médico com leads</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ranking de Canais */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-semibold">
                <Zap className="h-5 w-5 mr-2 text-blue-600" />
                Performance por Canal
              </CardTitle>
              <p className="text-sm text-gray-500">Ranking por volume de leads e conversão</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rankingCanais.slice(0, 8).map((canal, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-blue-400' : index === 2 ? 'bg-blue-300' : 'bg-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{canal.nome}</p>
                        <p className="text-xs text-gray-500">{canal.totalLeads} leads</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${
                          parseFloat(canal.taxaConversao) >= 50 ? 'bg-green-100 text-green-800' :
                          parseFloat(canal.taxaConversao) >= 30 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {canal.taxaConversao}% conv.
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-green-600 mt-1">{formatCurrency(canal.receita)}</p>
                    </div>
                  </div>
                ))}
                {rankingCanais.length === 0 && (
                  <p className="text-center text-gray-500 py-4">Nenhum dado de canal</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Leads Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leadsRecentes.map((lead) => (
                <div key={lead.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {lead.nome_paciente}
                    </p>
                    <p className="text-sm text-gray-500">
                      {getEspecialidadeNome(lead.especialidade_id)} • {formatTime(lead.data_registro_contato)}
                    </p>
                  </div>
                  <Badge 
                    variant={
                      lead.status === 'Convertido' ? 'default' :
                      lead.status === 'Agendado' ? 'secondary' :
                      lead.status === 'Lead' ? 'outline' : 'destructive'
                    }
                    className={
                      lead.status === 'Convertido' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                      lead.status === 'Agendado' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' :
                      lead.status === 'Lead' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' :
                      'bg-red-100 text-red-800 hover:bg-red-100'
                    }
                  >
                    {lead.status}
                  </Badge>
                </div>
              ))}
              {leadsRecentes.length === 0 && (
                <div className="text-center py-8">
                  <UserPlus className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Nenhum lead cadastrado ainda</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Próximos Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proximosAgendamentos.map((lead) => (
                <div key={lead.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {lead.nome_paciente}
                    </p>
                    <p className="text-sm text-gray-500">
                      {getMedicoNome(lead.medico_agendado_id)} • {getEspecialidadeNome(lead.especialidade_id)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(lead.valor_orcado)}</p>
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      Agendado
                    </Badge>
                  </div>
                </div>
              ))}
              {proximosAgendamentos.length === 0 && (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Nenhum agendamento pendente</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard
