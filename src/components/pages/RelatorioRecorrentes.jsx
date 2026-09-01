import { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    Legend,
    AreaChart,
    Area
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    RefreshCw,
    Users,
    TrendingUp,
    Calendar,
    DollarSign,
    Clock,
    Repeat,
    UserCheck,
    UserPlus,
    Filter,
    Download,
    Printer,
    ArrowUpRight,
    ArrowDownRight,
    Eye,
    Activity,
    Target,
    Stethoscope,
    Loader2,
    Award,
    Zap,
    BarChart3
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Flame, AlertCircle, AlertTriangle, PhoneOff, Snowflake, ArrowUp, Coins, BellRing, Search } from 'lucide-react'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'
import firebaseDataService from '@/services/firebaseDataService'
import { STATUS_COLORS, STATUS_VISITA_COLORS, parseLocalDate } from '@/constants/crm'

const COLORS = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

// Busca sem acento: "jose" precisa achar "José"
const semAcento = (texto) =>
    (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function RelatorioRecorrentes() {
    // Estados principais
    const [leads, setLeads] = useState([])
    const [medicos, setMedicos] = useState([])
    const [especialidades, setEspecialidades] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Estados de filtros
    const [showPeriodFilter, setShowPeriodFilter] = useState(false)
    const [periodFilter, setPeriodFilter] = useState({ startDate: '', endDate: '' })
    const [selectedMedicos, setSelectedMedicos] = useState([]) // Agora é um array para múltipla seleção
    const [dateFilterType, setDateFilterType] = useState('registro')
    const [selectedEspecialidadeFilter, setSelectedEspecialidadeFilter] = useState('all')
    // Filtra as passagens (lista + conversões) por quem as registrou
    const [selectedUsuario, setSelectedUsuario] = useState('todos')
    // Busca por paciente na lista de passagens ("quantas passagens a Fulana teve?")
    const [buscaPacientePassagens, setBuscaPacientePassagens] = useState('')

    // Estados de modais
    const [showLeadDetails, setShowLeadDetails] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState(null)
    const [categoryLeads, setCategoryLeads] = useState([])

    // Estados da aba Crosscheck
    const [activeTab, setActiveTab] = useState('recorrentes')
    const [crosscheckCategoryFilter, setCrosscheckCategoryFilter] = useState([]) // [] = todas
    const [crosscheckSearch, setCrosscheckSearch] = useState('')
    const [crosscheckUrgencyFilter, setCrosscheckUrgencyFilter] = useState('all') // all | critica | alta | media

    const reportRef = useRef(null)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            setError(null)

            const [leadsData, medicosData, especialidadesData] = await Promise.all([
                firebaseDataService.getAll('leads'),
                firebaseDataService.getAll('medicos'),
                firebaseDataService.getAll('especialidades')
            ])

            setLeads(leadsData)
            setMedicos(medicosData)
            setEspecialidades(especialidadesData)
        } catch (err) {
            console.error('Erro ao carregar dados:', err)
            setError('Erro ao carregar dados. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    // Determinar qual campo de data usar para filtros
    const getDateField = (lead) => dateFilterType === 'consulta'
        ? (lead.data_consulta_efetiva || lead.data_registro_contato)
        : lead.data_registro_contato

    // data_visita é 'YYYY-MM-DD': comparar como string ISO evita qualquer
    // deslocamento de fuso (new Date('YYYY-MM-DD') é UTC e recuava 1 dia no BRT)
    const visitaNoPeriodo = (visita) => {
        const d = String(visita?.data_visita || '').slice(0, 10)
        if (!d) return false
        if (periodFilter.startDate && d < periodFilter.startDate) return false
        if (periodFilter.endDate && d > periodFilter.endDate) return false
        return true
    }

    // Filtrar leads
    const getFilteredLeads = () => {
        let filtered = leads

        // Filtro por período
        if (periodFilter.startDate || periodFilter.endDate) {
            if (dateFilterType === 'passagem') {
                // Modo "Data da Passagem": o lead entra se QUALQUER visita do
                // histórico cair no período. Antes o período só olhava a data de
                // registro/consulta do lead — um paciente antigo que passou pela
                // clínica hoje ficava fora do relatório de hoje.
                filtered = filtered.filter(lead =>
                    (lead.historico_visitas || []).some(visitaNoPeriodo)
                )
            } else {
                filtered = filtered.filter(lead => {
                    const dataRegistro = new Date(getDateField(lead))
                    // 'T00:00:00'/'T23:59:59' sem sufixo Z = horário LOCAL — new Date('YYYY-MM-DD')
                    // puro era UTC e deslocava o início do período ~3h para o dia anterior (BRT)
                    if (periodFilter.startDate && periodFilter.endDate) {
                        return dataRegistro >= new Date(periodFilter.startDate + 'T00:00:00') &&
                            dataRegistro <= new Date(periodFilter.endDate + 'T23:59:59.999')
                    } else if (periodFilter.startDate) {
                        return dataRegistro >= new Date(periodFilter.startDate + 'T00:00:00')
                    } else if (periodFilter.endDate) {
                        return dataRegistro <= new Date(periodFilter.endDate + 'T23:59:59.999')
                    }
                    return true
                })
            }
        }

        // Filtro por médicos (múltipla seleção) - considera médico agendado E médicos das visitas
        if (selectedMedicos.length > 0) {
            filtered = filtered.filter(lead => {
                // Verificar se o médico agendado está na seleção
                if (selectedMedicos.includes(lead.medico_agendado_id)) {
                    return true
                }

                // Verificar se algum médico do histórico de visitas está na seleção
                const historicoVisitas = lead.historico_visitas || []
                return historicoVisitas.some(visita => selectedMedicos.includes(visita.medico_id))
            })
        }

        // Filtro por usuário: só leads em que a pessoa registrou ao menos uma
        // passagem. Aplicado AQUI para o relatório INTEIRO (cards, Top 10,
        // rankings) refletir a pessoa — restrito à lista de passagens, o filtro
        // parecia não funcionar para quem olhava o resto da página.
        if (selectedUsuario !== 'todos') {
            filtered = filtered.filter(lead =>
                (lead.historico_visitas || []).some(
                    v => (v.registrado_por_nome || 'Não informado') === selectedUsuario
                )
            )
        }

        return filtered
    }

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0)
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A'
        try {
            return new Date(dateString).toLocaleDateString('pt-BR')
        } catch {
            return 'N/A'
        }
    }

    const getMedicoNome = (id) => {
        const medico = medicos.find(m => m.id === id)
        return medico ? medico.nome : 'N/A'
    }

    // ==========================================
    // ANÁLISES ESTATÍSTICAS DE RECORRÊNCIA
    // ==========================================

    // Classificacao com suporte a multiespecialidade
    const isRecorrente = (lead) => {
      if (selectedEspecialidadeFilter !== 'all' && lead.visitas_por_especialidade) {
        return (lead.visitas_por_especialidade[selectedEspecialidadeFilter] || 0) > 1
      }
      return lead.tipo_visita === 'Recorrente' || (lead.total_visitas && lead.total_visitas > 1)
    }

    const analiseRecorrencia = useMemo(() => {
        const filteredLeads = getFilteredLeads()

        // Separar recorrentes dos novos
        const recorrentes = filteredLeads.filter(lead => isRecorrente(lead))
        const novos = filteredLeads.filter(lead => !isRecorrente(lead))

        // Calcular valores — usa valor_total_gasto (visitas + produtos) se disponível
        const valorRecorrentes = recorrentes.reduce((sum, lead) => {
            const valorGasto = lead.valor_total_gasto || 0
            const valorVisitas = lead.valor_total_visitas || 0
            const valorProdutos = lead.total_gasto_produtos || 0
            const valorOrcado = lead.valor_orcado || 0
            // Prioriza: valor_total_gasto > (visitas+produtos) > valor_orcado
            const melhorValor = valorGasto > 0 ? valorGasto : (valorVisitas + valorProdutos > 0 ? valorVisitas + valorProdutos : valorOrcado)
            return sum + melhorValor
        }, 0)

        const valorNovos = novos.reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0)

        // Conversões — considera status Convertido OU orçamento fechado
        const isConvertido = (lead) => lead.status === 'Convertido' || lead.orcamento_fechado === 'Total' || lead.orcamento_fechado === 'Parcial'
        const convertidosRecorrentes = recorrentes.filter(isConvertido).length
        const convertidosNovos = novos.filter(isConvertido).length

        // Frequência média
        const leadsComVisitas = filteredLeads.filter(lead => lead.total_visitas && lead.total_visitas > 1)
        const mediaDiasEntreVisitas = leadsComVisitas.length > 0
            ? Math.round(leadsComVisitas.reduce((sum, lead) => sum + (lead.media_dias_entre_visitas || 0), 0) / leadsComVisitas.length)
            : 0

        // Total de visitas do período
        const totalVisitas = filteredLeads.reduce((sum, lead) => sum + (lead.total_visitas || 1), 0)

        // Média de visitas por paciente recorrente
        const mediaVisitasPorRecorrente = recorrentes.length > 0
            ? (recorrentes.reduce((sum, lead) => sum + (lead.total_visitas || 0), 0) / recorrentes.length).toFixed(1)
            : 0

        return {
            total: filteredLeads.length,
            recorrentes: {
                quantidade: recorrentes.length,
                valor: valorRecorrentes,
                convertidos: convertidosRecorrentes,
                taxaConversao: recorrentes.length > 0 ? ((convertidosRecorrentes / recorrentes.length) * 100).toFixed(1) : 0,
                ticketMedio: recorrentes.length > 0 ? valorRecorrentes / recorrentes.length : 0
            },
            novos: {
                quantidade: novos.length,
                valor: valorNovos,
                convertidos: convertidosNovos,
                taxaConversao: novos.length > 0 ? ((convertidosNovos / novos.length) * 100).toFixed(1) : 0,
                ticketMedio: novos.length > 0 ? valorNovos / novos.length : 0
            },
            taxaRecorrencia: filteredLeads.length > 0 ? ((recorrentes.length / filteredLeads.length) * 100).toFixed(1) : 0,
            mediaDiasEntreVisitas,
            totalVisitas,
            mediaVisitasPorRecorrente,
            leadsComVisitas: leadsComVisitas.length
        }
    }, [leads, periodFilter, selectedMedicos, dateFilterType, selectedEspecialidadeFilter, selectedUsuario])

    // Análise mensal de recorrência
    const analiseMenual = useMemo(() => {
        const filteredLeads = getFilteredLeads()
        const meses = {}

        filteredLeads.forEach(lead => {
            const leadIsRecorrente = isRecorrente(lead)

            // Para recorrentes, usar a data da última visita
            // Para novos, usar a data de registro/contato
            let dataReferencia
            if (leadIsRecorrente) {
                dataReferencia = lead.ultima_visita || lead.data_registro_contato
            } else {
                dataReferencia = lead.data_registro_contato
            }

            if (!dataReferencia) return

            const data = new Date(dataReferencia)
            const mesAno = `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`

            if (!meses[mesAno]) {
                meses[mesAno] = { mes: mesAno, novos: 0, recorrentes: 0, valorNovos: 0, valorRecorrentes: 0 }
            }

            const valor = lead.valor_orcado || 0

            if (leadIsRecorrente) {
                meses[mesAno].recorrentes++
                meses[mesAno].valorRecorrentes += Math.max(lead.valor_total_visitas || 0, valor)
            } else {
                meses[mesAno].novos++
                meses[mesAno].valorNovos += valor
            }
        })

        return Object.values(meses)
            .sort((a, b) => {
                const [mesA, anoA] = a.mes.split('/')
                const [mesB, anoB] = b.mes.split('/')
                return new Date(anoA, mesA - 1) - new Date(anoB, mesB - 1)
            })
            .slice(-12)
    }, [leads, periodFilter, selectedMedicos, dateFilterType, selectedEspecialidadeFilter, selectedUsuario])

    // Top pacientes recorrentes
    const topRecorrentes = useMemo(() => {
        const filteredLeads = getFilteredLeads()

        return filteredLeads
            .filter(lead => lead.total_visitas && lead.total_visitas > 1)
            .sort((a, b) => (b.total_visitas || 0) - (a.total_visitas || 0))
            .slice(0, 10)
    }, [leads, periodFilter, selectedMedicos, dateFilterType, selectedUsuario])

    // Todas as passagens individuais do período, uma linha por visita.
    // É o que faltava para "quem passou pela clínica hoje?": o Top 10 acima é um
    // ranking por contagem — um paciente com poucas visitas nunca entrava nele,
    // e nenhuma outra lista mostrava as passagens em si.
    const passagensPeriodo = useMemo(() => {
        const filteredLeads = getFilteredLeads()
        const temPeriodo = Boolean(periodFilter.startDate || periodFilter.endDate)
        const linhas = []

        // Busca por paciente: com um nome digitado, o card vira o resumo daquele
        // paciente — o total no título responde "quantas passagens ele teve"
        const termoBusca = semAcento(buscaPacientePassagens.trim())
        const digitosBusca = buscaPacientePassagens.replace(/\D/g, '')

        filteredLeads.forEach(lead => {
            if (termoBusca) {
                const nomeCasa = semAcento(lead.nome_paciente).includes(termoBusca)
                const telefoneCasa = digitosBusca.length >= 3 &&
                    (lead.telefone || '').replace(/\D/g, '').includes(digitosBusca)
                if (!nomeCasa && !telefoneCasa) return
            }
            (lead.historico_visitas || []).forEach(visita => {
                if (temPeriodo && !visitaNoPeriodo(visita)) return
                // Com médicos selecionados, mostrar só as passagens desses médicos
                // (o filtro de lead acima mantém o paciente; aqui filtramos a linha)
                if (selectedMedicos.length > 0 && !selectedMedicos.includes(visita.medico_id)) return
                if (selectedUsuario !== 'todos' && (visita.registrado_por_nome || 'Não informado') !== selectedUsuario) return
                linhas.push({ lead, visita })
            })
        })

        linhas.sort((a, b) => String(b.visita.data_visita || '').localeCompare(String(a.visita.data_visita || '')))
        return {
            linhas,
            valorTotal: linhas.reduce((sum, l) => sum + (parseFloat(l.visita.valor) || 0), 0),
            pacientesUnicos: new Set(linhas.map(l => l.lead.id)).size
        }
    }, [leads, periodFilter, selectedMedicos, dateFilterType, selectedEspecialidadeFilter, selectedUsuario, buscaPacientePassagens])

    // Usuários que já registraram alguma passagem (sobre TODOS os leads, para a
    // lista de opções não encolher conforme o próprio filtro é aplicado)
    const usuariosComPassagem = useMemo(() => {
        const nomes = new Set()
        leads.forEach(lead => {
            (lead.historico_visitas || []).forEach(v => {
                nomes.add(v.registrado_por_nome || 'Não informado')
            })
        })
        return Array.from(nomes).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    }, [leads])

    // Quem (usuário do sistema) está registrando e convertendo as passagens.
    // registrado_por_nome é o usuário logado que gravou a passagem — a melhor
    // aproximação de "quem converteu"; o médico da visita é outra coluna.
    const conversoesPorUsuario = useMemo(() => {
        const mapa = {}
        passagensPeriodo.linhas.forEach(({ visita }) => {
            const nome = visita.registrado_por_nome || 'Não informado'
            if (!mapa[nome]) mapa[nome] = { nome, passagens: 0, convertidas: 0, valorConvertidas: 0 }
            mapa[nome].passagens++
            if (visita.status === 'Convertido' || visita.status === 'Convertido Parcial') {
                mapa[nome].convertidas++
                mapa[nome].valorConvertidas += parseFloat(visita.valor) || 0
            }
        })
        return Object.values(mapa)
            .sort((a, b) => b.convertidas - a.convertidas || b.passagens - a.passagens)
    }, [passagensPeriodo])

    // Análise por médico - considera visitas do histórico, não apenas o médico agendado
    const recorrenciaPorMedico = useMemo(() => {
        const filteredLeads = getFilteredLeads()
        const medicoStats = {}

        // Inicializar stats para todos os médicos
        medicos.forEach(medico => {
            medicoStats[medico.id] = {
                id: medico.id,
                nome: medico.nome,
                totalPacientes: 0,
                totalVisitas: 0,
                pacientesRecorrentes: new Set(), // Usar Set para contar pacientes únicos
                valorTotal: 0
            }
        })

        // Processar cada lead e seu histórico de visitas
        filteredLeads.forEach(lead => {
            const historicoVisitas = lead.historico_visitas || []

            // Se tem histórico de visitas, usar ele para contabilizar médicos
            if (historicoVisitas.length > 0) {
                historicoVisitas.forEach(visita => {
                    const medicoId = visita.medico_id
                    if (medicoId && medicoStats[medicoId]) {
                        medicoStats[medicoId].totalVisitas++
                        medicoStats[medicoId].valorTotal += parseFloat(visita.valor || 0)

                        // Se o paciente tem mais de 1 visita, é recorrente
                        if (lead.total_visitas && lead.total_visitas > 1) {
                            medicoStats[medicoId].pacientesRecorrentes.add(lead.id)
                        }
                    }
                })
            } else {
                // Se não tem histórico, usar o médico agendado
                const medicoId = lead.medico_agendado_id
                if (medicoId && medicoStats[medicoId]) {
                    medicoStats[medicoId].totalVisitas++
                    medicoStats[medicoId].valorTotal += parseFloat(lead.valor_orcado || 0)
                }
            }

            // Contar paciente para o médico agendado
            const medicoAgendado = lead.medico_agendado_id
            if (medicoAgendado && medicoStats[medicoAgendado]) {
                medicoStats[medicoAgendado].totalPacientes++
            }
        })

        // Converter para formato final e filtrar médicos sem dados
        return Object.values(medicoStats)
            .map(stats => ({
                nome: stats.nome,
                total: stats.totalPacientes,
                visitas: stats.totalVisitas,
                recorrentes: stats.pacientesRecorrentes.size,
                taxaRecorrencia: stats.totalPacientes > 0
                    ? ((stats.pacientesRecorrentes.size / stats.totalPacientes) * 100).toFixed(1)
                    : 0,
                valorRecorrentes: stats.valorTotal
            }))
            .filter(stats => stats.visitas > 0 || stats.total > 0)
            .sort((a, b) => b.recorrentes - a.recorrentes)
            .slice(0, 10)
    }, [leads, medicos, periodFilter, selectedMedicos, dateFilterType, selectedEspecialidadeFilter, selectedUsuario])

    // Análise de retenção - Dias desde última visita
    const analiseRetencao = useMemo(() => {
        const filteredLeads = getFilteredLeads()
        const categorias = {
            'Até 30 dias': 0,
            '31-60 dias': 0,
            '61-90 dias': 0,
            '91-180 dias': 0,
            'Mais de 180 dias': 0
        }

        const hoje = new Date()

        filteredLeads.forEach(lead => {
            const ultimaVisita = lead.ultima_visita || lead.data_registro_contato
            if (!ultimaVisita) return

            const dias = Math.floor((hoje - new Date(ultimaVisita)) / (1000 * 60 * 60 * 24))

            if (dias <= 30) categorias['Até 30 dias']++
            else if (dias <= 60) categorias['31-60 dias']++
            else if (dias <= 90) categorias['61-90 dias']++
            else if (dias <= 180) categorias['91-180 dias']++
            else categorias['Mais de 180 dias']++
        })

        return Object.entries(categorias).map(([categoria, quantidade]) => ({
            categoria,
            quantidade
        }))
    }, [leads, periodFilter, selectedMedicos, dateFilterType, selectedEspecialidadeFilter, selectedUsuario])

    // Análise de frequência de visitas
    const analiseFrequencia = useMemo(() => {
        const filteredLeads = getFilteredLeads()
        const categorias = {
            '1 visita': 0,
            '2 visitas': 0,
            '3-4 visitas': 0,
            '5-10 visitas': 0,
            'Mais de 10': 0
        }

        filteredLeads.forEach(lead => {
            const visitas = lead.total_visitas || 1

            if (visitas === 1) categorias['1 visita']++
            else if (visitas === 2) categorias['2 visitas']++
            else if (visitas <= 4) categorias['3-4 visitas']++
            else if (visitas <= 10) categorias['5-10 visitas']++
            else categorias['Mais de 10']++
        })

        return Object.entries(categorias).map(([categoria, quantidade]) => ({
            categoria,
            quantidade,
            cor: COLORS[Object.keys(categorias).indexOf(categoria) % COLORS.length]
        }))
    }, [leads, periodFilter, selectedMedicos, dateFilterType, selectedEspecialidadeFilter, selectedUsuario])

    // Pacientes inativos - sem visita há mais de X dias
    const pacientesInativos = useMemo(() => {
        const filteredLeads = getFilteredLeads()
        const hoje = new Date()

        const inativos = {
            '30-60 dias': [],
            '61-90 dias': [],
            '91-180 dias': [],
            'Mais de 180 dias': []
        }

        filteredLeads.forEach(lead => {
            // Somente leads que já tiveram visitas (recorrentes ou com primeira visita)
            if (!lead.ultima_visita && !lead.primeira_visita) return

            const ultimaVisita = lead.ultima_visita || lead.primeira_visita || lead.data_registro_contato
            if (!ultimaVisita) return

            const dias = Math.floor((hoje - new Date(ultimaVisita)) / (1000 * 60 * 60 * 24))

            if (dias > 30 && dias <= 60) inativos['30-60 dias'].push({ ...lead, diasSemVisita: dias })
            else if (dias > 60 && dias <= 90) inativos['61-90 dias'].push({ ...lead, diasSemVisita: dias })
            else if (dias > 90 && dias <= 180) inativos['91-180 dias'].push({ ...lead, diasSemVisita: dias })
            else if (dias > 180) inativos['Mais de 180 dias'].push({ ...lead, diasSemVisita: dias })
        })

        return inativos
    }, [leads, periodFilter, selectedMedicos, dateFilterType, selectedEspecialidadeFilter, selectedUsuario])

    // ==========================================
    // CROSSCHECK — DETECÇÃO DE OPORTUNIDADES
    // ==========================================
    // Mapa de metadados das categorias (label, ícone, cor, peso, urgência base)
    const CROSSCHECK_CATEGORIAS = {
        reserva_paga_sem_consulta: { label: 'Reserva paga sem consulta', icon: '🔥', cor: 'bg-red-100 text-red-800 border-red-300', peso: 10 },
        followup_vencido:          { label: 'Follow-up vencido',         icon: '⏰', cor: 'bg-amber-100 text-amber-800 border-amber-300', peso: 8 },
        desmarcou_faltou:          { label: 'Desmarcou / Faltou',        icon: '💔', cor: 'bg-rose-100 text-rose-800 border-rose-300', peso: 7 },
        em_conversa_frio:          { label: 'Em Conversa esfriado',      icon: '🧊', cor: 'bg-cyan-100 text-cyan-800 border-cyan-300', peso: 6 },
        upsell_parcial:            { label: 'Upsell — orçamento parcial',icon: '💰', cor: 'bg-lime-100 text-lime-800 border-lime-300', peso: 7 },
        recorrente_silencioso:    { label: 'Recorrente silencioso',     icon: '🔁', cor: 'bg-indigo-100 text-indigo-800 border-indigo-300', peso: 6 },
        nao_agendou_premium:      { label: 'Não Agendou — alto valor',  icon: '📞', cor: 'bg-violet-100 text-violet-800 border-violet-300', peso: 8 },
        sem_interacao_atraso:     { label: 'Sem interação >48h',         icon: '🆕', cor: 'bg-orange-100 text-orange-800 border-orange-300', peso: 9 },
    }

    const URGENCIA_COLORS = {
        critica: 'bg-red-600 text-white',
        alta:    'bg-orange-500 text-white',
        media:   'bg-yellow-500 text-white',
    }

    // Análise principal de oportunidades — gera 1 item por (lead × categoria detectada)
    const analiseCrosscheck = useMemo(() => {
        const filteredLeads = getFilteredLeads()
        const hoje = new Date()
        const diffDays = (data) => {
            if (!data) return null
            const d = new Date(data)
            if (Number.isNaN(d.getTime())) return null
            return Math.floor((hoje - d) / (1000 * 60 * 60 * 24))
        }

        const oportunidades = []

        const pushOp = (lead, categoria, extra) => {
            const meta = CROSSCHECK_CATEGORIAS[categoria]
            if (!meta) return
            oportunidades.push({
                opId: `${lead.id}_${categoria}${extra.suffix || ''}`,
                leadId: lead.id,
                nome: lead.nome_paciente || 'N/A',
                telefone: lead.telefone || '',
                email: lead.email || '',
                status: lead.status || 'Lead',
                medicoId: lead.medico_agendado_id || '',
                canal: lead.canal_contato || '',
                dataRegistro: lead.data_registro_contato,
                ultimaAlteracao: lead.data_ultima_alteracao,
                ultimaVisita: lead.ultima_visita,
                categoria,
                categoriaLabel: meta.label,
                icone: meta.icon,
                peso: meta.peso,
                ...extra,
            })
        }

        // Pre-cálculo: percentil 75 de valor_orcado entre Não Agendou (cat 7)
        const naoAgendouValores = filteredLeads
            .filter(l => l.status === 'Não Agendou')
            .map(l => parseFloat(l.valor_orcado || 0))
            .filter(v => v > 0)
            .sort((a, b) => a - b)
        const p75NaoAgendou = naoAgendouValores.length
            ? naoAgendouValores[Math.floor(naoAgendouValores.length * 0.75)]
            : 0

        filteredLeads.forEach(lead => {
            const diasRegistro = diffDays(lead.data_registro_contato) ?? 0
            const diasUltAlt   = diffDays(lead.data_ultima_alteracao)
            const diasUltVisita = diffDays(lead.ultima_visita || lead.primeira_visita)
            const diasParadoGeral = diasUltAlt ?? diasRegistro
            const valorOrcado = parseFloat(lead.valor_orcado || 0)

            // Cat 1 — Reserva paga sem consulta efetivada
            if (lead.pagou_reserva && !lead.data_consulta_efetiva && diasRegistro > 7) {
                pushOp(lead, 'reserva_paga_sem_consulta', {
                    diasParado: diasRegistro,
                    valorOportunidade: valorOrcado || parseFloat(lead.valor_consulta || 0),
                    urgencia: 'critica',
                    acao: 'Ligar HOJE — paciente pagou reserva mas não compareceu. Confirmar nova data.',
                })
            }

            // Cat 2 — Follow-ups vencidos (1, 2, 3)
            for (const n of [1, 2, 3]) {
                const dataFu = lead[`followup${n}_data`]
                const realizado = lead[`followup${n}_realizado`]
                if (dataFu && !realizado) {
                    const diasAtraso = diffDays(dataFu)
                    if (diasAtraso !== null && diasAtraso > 0) {
                        pushOp(lead, 'followup_vencido', {
                            suffix: `_${n}`,
                            diasParado: diasAtraso,
                            valorOportunidade: valorOrcado,
                            urgencia: diasAtraso > 7 ? 'alta' : 'media',
                            acao: `Executar Follow-up ${n} (vencido há ${diasAtraso} dias).`,
                            categoriaLabel: `Follow-up ${n} vencido`,
                        })
                    }
                }
            }

            // Cat 3 — Desmarcou / Faltou sem retomada
            if (['Desmarcou', 'Faltou'].includes(lead.status) && diasParadoGeral > 3) {
                pushOp(lead, 'desmarcou_faltou', {
                    diasParado: diasParadoGeral,
                    valorOportunidade: valorOrcado,
                    urgencia: diasParadoGeral > 14 ? 'alta' : 'media',
                    acao: `${lead.status} há ${diasParadoGeral} dias — reabordagem com nova oferta de horário.`,
                })
            }

            // Cat 4 — Em Conversa esfriado
            if (lead.status === 'Em Conversa' && diasParadoGeral > 5) {
                pushOp(lead, 'em_conversa_frio', {
                    diasParado: diasParadoGeral,
                    valorOportunidade: valorOrcado,
                    urgencia: diasParadoGeral > 15 ? 'alta' : 'media',
                    acao: `Sem interação há ${diasParadoGeral} dias — recuperar lead morno.`,
                })
            }

            // Cat 5 — Upsell em Convertido Parcial
            if (lead.status === 'Convertido Parcial' || lead.orcamento_fechado === 'Parcial') {
                const fechado = parseFloat(lead.valor_fechado_parcial || 0)
                const diff = valorOrcado - fechado
                if (diff > 0) {
                    pushOp(lead, 'upsell_parcial', {
                        diasParado: diasParadoGeral,
                        valorOportunidade: diff,
                        urgencia: 'media',
                        acao: `Fechar diferença de ${formatCurrency(diff)} no orçamento.`,
                    })
                }
            }

            // Cat 6 — Recorrente silencioso (60-180 dias sem visita, sem agendamento futuro)
            const totalVisitas = lead.total_visitas || 0
            if (totalVisitas >= 1 && diasUltVisita !== null && diasUltVisita >= 60 && diasUltVisita <= 180) {
                const temAgFuturo = lead.data_consulta_efetiva && new Date(lead.data_consulta_efetiva) > hoje
                const statusAgendado = ['Agendado', 'Confirmado', 'Reagendado'].includes(lead.status)
                if (!temAgFuturo && !statusAgendado) {
                    const valorHist = parseFloat(lead.valor_total_gasto || lead.valor_total_visitas || valorOrcado || 0)
                    pushOp(lead, 'recorrente_silencioso', {
                        diasParado: diasUltVisita,
                        valorOportunidade: valorHist,
                        urgencia: diasUltVisita > 120 ? 'alta' : 'media',
                        acao: `Sem visita há ${diasUltVisita} dias (${totalVisitas} visitas no histórico). Ligação preventiva/retorno.`,
                    })
                }
            }

            // Cat 7 — Não Agendou com orçamento alto (top 25%)
            if (lead.status === 'Não Agendou' && valorOrcado >= p75NaoAgendou && valorOrcado > 0) {
                pushOp(lead, 'nao_agendou_premium', {
                    diasParado: diasParadoGeral,
                    valorOportunidade: valorOrcado,
                    urgencia: 'alta',
                    acao: `Orçamento ${formatCurrency(valorOrcado)} — tentativa premium com gestor.`,
                })
            }

            // Cat 8 — Sem Interação há mais de 2 dias
            if (lead.status === 'Sem Interação' && diasRegistro >= 2) {
                pushOp(lead, 'sem_interacao_atraso', {
                    diasParado: diasRegistro,
                    valorOportunidade: valorOrcado,
                    urgencia: diasRegistro > 5 ? 'alta' : 'media',
                    acao: `Lead criado há ${diasRegistro} dias sem interação. Atribuir responsável e iniciar contato.`,
                })
            }
        })

        // Score 0-100: peso × (1 + dias/30) × (1 + valor/10000)
        const comScore = oportunidades.map(o => {
            const fatorDias  = Math.min((o.diasParado || 0) / 30, 3)
            const fatorValor = Math.min((o.valorOportunidade || 0) / 10000, 5)
            const raw = o.peso * (1 + fatorDias) * (1 + fatorValor)
            return { ...o, score: Math.min(Math.round(raw), 100) }
        })

        return comScore.sort((a, b) => b.score - a.score)
    }, [leads, periodFilter, selectedMedicos, dateFilterType, selectedEspecialidadeFilter, selectedUsuario])

    // Aplicar filtros locais da aba Crosscheck
    const crosscheckFiltrado = useMemo(() => {
        let arr = analiseCrosscheck

        if (crosscheckCategoryFilter.length > 0) {
            arr = arr.filter(o => crosscheckCategoryFilter.includes(o.categoria))
        }
        if (crosscheckUrgencyFilter !== 'all') {
            arr = arr.filter(o => o.urgencia === crosscheckUrgencyFilter)
        }
        if (crosscheckSearch.trim()) {
            const q = crosscheckSearch.trim().toLowerCase()
            arr = arr.filter(o =>
                o.nome.toLowerCase().includes(q) ||
                (o.telefone || '').toLowerCase().includes(q)
            )
        }
        return arr
    }, [analiseCrosscheck, crosscheckCategoryFilter, crosscheckUrgencyFilter, crosscheckSearch])

    // KPIs do Crosscheck
    const crosscheckKPIs = useMemo(() => {
        const total = analiseCrosscheck.length
        const valorTotal = analiseCrosscheck.reduce((sum, o) => sum + (o.valorOportunidade || 0), 0)
        const criticas = analiseCrosscheck.filter(o => o.urgencia === 'critica').length
        const altas    = analiseCrosscheck.filter(o => o.urgencia === 'alta').length
        const pacientesUnicos = new Set(analiseCrosscheck.map(o => o.leadId)).size
        const breakdownCategoria = Object.keys(CROSSCHECK_CATEGORIAS).map(cat => ({
            categoria: cat,
            label: CROSSCHECK_CATEGORIAS[cat].label,
            qtd: analiseCrosscheck.filter(o => o.categoria === cat).length,
        })).filter(b => b.qtd > 0).sort((a, b) => b.qtd - a.qtd)
        return { total, valorTotal, criticas, altas, pacientesUnicos, breakdownCategoria }
    }, [analiseCrosscheck])

    // Export Excel da aba Crosscheck
    const handleExportCrosscheckXLSX = () => {
        try {
            const wb = XLSX.utils.book_new()
            const header = ['#', 'Score', 'Urgência', 'Categoria', 'Paciente', 'Telefone', 'Status', 'Dias parado', 'Valor oportunidade (R$)', 'Ação sugerida']
            const rows = crosscheckFiltrado.map((o, i) => [
                i + 1,
                o.score,
                o.urgencia,
                o.categoriaLabel,
                o.nome,
                o.telefone,
                o.status,
                o.diasParado,
                o.valorOportunidade || 0,
                o.acao,
            ])
            const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
            ws['!cols'] = [{ wch: 5 }, { wch: 7 }, { wch: 10 }, { wch: 28 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 60 }]
            XLSX.utils.book_append_sheet(wb, ws, 'Crosscheck Oportunidades')
            const dataHoje = new Date().toISOString().slice(0, 10)
            XLSX.writeFile(wb, `Crosscheck_Oportunidades_${dataHoje}.xlsx`)
        } catch (error) {
            console.error('Erro ao exportar Crosscheck XLSX:', error)
            alert('Erro ao exportar. Tente novamente.')
        }
    }

    // ==========================================
    // RANKINGS DE PERFORMANCE POR INDICADOR
    // ==========================================

    // Ranking de médicos por volume e conversão
    const rankingMedicosPerformance = useMemo(() => {
        const filteredLeads = getFilteredLeads()
        const isConvertido = (lead) => lead.status === 'Convertido' || lead.orcamento_fechado === 'Total' || lead.orcamento_fechado === 'Parcial'

        return medicos.map(medico => {
            const medicoLeads = filteredLeads.filter(l => l.medico_agendado_id === medico.id)
            const convertidos = medicoLeads.filter(isConvertido)
            const recorrentes = medicoLeads.filter(isRecorrente)
            const receita = convertidos.reduce((sum, l) => {
                if (l.orcamento_fechado === 'Parcial') return sum + (l.valor_fechado_parcial || 0)
                return sum + (l.valor_orcado || 0)
            }, 0)
            const receitaRecorrentes = recorrentes.reduce((sum, l) => {
                const totalGasto = l.valor_total_gasto || (l.valor_total_visitas || 0) + (l.total_gasto_produtos || 0)
                return sum + (totalGasto > 0 ? totalGasto : (l.valor_orcado || 0))
            }, 0)

            return {
                nome: medico.nome,
                totalLeads: medicoLeads.length,
                convertidos: convertidos.length,
                recorrentes: recorrentes.length,
                taxaConversao: medicoLeads.length > 0 ? ((convertidos.length / medicoLeads.length) * 100).toFixed(1) : '0.0',
                taxaRecorrencia: medicoLeads.length > 0 ? ((recorrentes.length / medicoLeads.length) * 100).toFixed(1) : '0.0',
                receita,
                receitaRecorrentes
            }
        }).filter(m => m.totalLeads > 0).sort((a, b) => b.totalLeads - a.totalLeads)
    }, [leads, medicos, periodFilter, selectedMedicos, dateFilterType, selectedEspecialidadeFilter, selectedUsuario])

    // Ranking de canais por volume e conversão
    const rankingCanaisPerformance = useMemo(() => {
        const filteredLeads = getFilteredLeads()
        const isConvertido = (lead) => lead.status === 'Convertido' || lead.orcamento_fechado === 'Total' || lead.orcamento_fechado === 'Parcial'
        const canaisMap = {}

        filteredLeads.forEach(lead => {
            const canal = lead.canal_contato || 'Não informado'
            if (!canaisMap[canal]) canaisMap[canal] = { nome: canal, totalLeads: 0, convertidos: 0, recorrentes: 0, receita: 0 }
            canaisMap[canal].totalLeads++
            if (isConvertido(lead)) {
                canaisMap[canal].convertidos++
                canaisMap[canal].receita += lead.orcamento_fechado === 'Parcial' ? (lead.valor_fechado_parcial || 0) : (lead.valor_orcado || 0)
            }
            if (isRecorrente(lead)) canaisMap[canal].recorrentes++
        })

        return Object.values(canaisMap).map(c => ({
            ...c,
            taxaConversao: c.totalLeads > 0 ? ((c.convertidos / c.totalLeads) * 100).toFixed(1) : '0.0',
            taxaRecorrencia: c.totalLeads > 0 ? ((c.recorrentes / c.totalLeads) * 100).toFixed(1) : '0.0'
        })).sort((a, b) => b.totalLeads - a.totalLeads)
    }, [leads, periodFilter, selectedMedicos, dateFilterType, selectedEspecialidadeFilter, selectedUsuario])

    // Ranking de especialidades por volume e conversão
    const rankingEspecialidades = useMemo(() => {
        const filteredLeads = getFilteredLeads()
        const isConvertido = (lead) => lead.status === 'Convertido' || lead.orcamento_fechado === 'Total' || lead.orcamento_fechado === 'Parcial'

        return especialidades.map(esp => {
            const espLeads = filteredLeads.filter(l => l.especialidade_id === esp.id)
            const convertidos = espLeads.filter(isConvertido)
            const recorrentes = espLeads.filter(isRecorrente)
            const receita = convertidos.reduce((sum, l) => {
                if (l.orcamento_fechado === 'Parcial') return sum + (l.valor_fechado_parcial || 0)
                return sum + (l.valor_orcado || 0)
            }, 0)

            return {
                nome: esp.nome,
                totalLeads: espLeads.length,
                convertidos: convertidos.length,
                recorrentes: recorrentes.length,
                taxaConversao: espLeads.length > 0 ? ((convertidos.length / espLeads.length) * 100).toFixed(1) : '0.0',
                taxaRecorrencia: espLeads.length > 0 ? ((recorrentes.length / espLeads.length) * 100).toFixed(1) : '0.0',
                receita
            }
        }).filter(e => e.totalLeads > 0).sort((a, b) => b.totalLeads - a.totalLeads)
    }, [leads, especialidades, periodFilter, selectedMedicos, dateFilterType, selectedEspecialidadeFilter, selectedUsuario])

    // Distribuição para gráfico de pizza
    const pieData = useMemo(() => {
        return [
            { name: 'Pacientes Novos', value: analiseRecorrencia.novos.quantidade, color: '#3b82f6' },
            { name: 'Pacientes Recorrentes', value: analiseRecorrencia.recorrentes.quantidade, color: '#10b981' }
        ]
    }, [analiseRecorrencia])

    // Funções de visualização de detalhes
    const viewCategoryDetails = (category, type) => {
        const filteredLeads = getFilteredLeads()
        let leadsList = []

        if (type === 'recorrentes') {
            leadsList = filteredLeads.filter(lead => isRecorrente(lead))
        } else if (type === 'novos') {
            leadsList = filteredLeads.filter(lead => !isRecorrente(lead))
        } else if (type === 'retencao') {
            const hoje = new Date()
            leadsList = filteredLeads.filter(lead => {
                const ultimaVisita = lead.ultima_visita || lead.data_registro_contato
                if (!ultimaVisita) return false
                const dias = Math.floor((hoje - new Date(ultimaVisita)) / (1000 * 60 * 60 * 24))

                switch (category) {
                    case 'Até 30 dias': return dias <= 30
                    case '31-60 dias': return dias > 30 && dias <= 60
                    case '61-90 dias': return dias > 60 && dias <= 90
                    case '91-180 dias': return dias > 90 && dias <= 180
                    case 'Mais de 180 dias': return dias > 180
                    default: return false
                }
            })
        } else if (type === 'frequencia') {
            leadsList = filteredLeads.filter(lead => {
                const visitas = lead.total_visitas || 1
                switch (category) {
                    case '1 visita': return visitas === 1
                    case '2 visitas': return visitas === 2
                    case '3-4 visitas': return visitas >= 3 && visitas <= 4
                    case '5-10 visitas': return visitas >= 5 && visitas <= 10
                    case 'Mais de 10': return visitas > 10
                    default: return false
                }
            })
        }

        setSelectedCategory({ name: category, type })
        setCategoryLeads(leadsList)
        setShowLeadDetails(true)
    }

    // Limpar filtros
    const clearFilters = () => {
        setPeriodFilter({ startDate: '', endDate: '' })
        setSelectedMedicos([])
        setDateFilterType('registro')
        setSelectedEspecialidadeFilter('all')
        setSelectedUsuario('todos')
    }

    // Imprimir relatório
    const handlePrint = async () => {
        try {
            const printWindow = window.open('', '_blank')

            printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Relatório de Recorrentes - ${formatDate(new Date().toISOString())}</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
              .header { text-align: center; border-bottom: 2px solid #8b5cf6; padding-bottom: 20px; margin-bottom: 30px; }
              h1 { color: #1f2937; margin: 0; }
              .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
              .stat-card { padding: 15px; border-radius: 8px; text-align: center; }
              .stat-card.primary { background: #8b5cf620; border: 1px solid #8b5cf6; }
              .stat-card.success { background: #10b98120; border: 1px solid #10b981; }
              .stat-card.blue { background: #3b82f620; border: 1px solid #3b82f6; }
              .stat-card.warning { background: #f59e0b20; border: 1px solid #f59e0b; }
              .stat-card h3 { font-size: 12px; color: #6b7280; margin: 0 0 8px 0; }
              .stat-card .value { font-size: 24px; font-weight: bold; color: #1f2937; }
              .section { margin-bottom: 30px; }
              .section h2 { color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
              th { background: #f9fafb; font-weight: 600; }
              .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📊 Relatório de Recorrentes</h1>
              <p>Gerado em: ${new Date().toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })}</p>
            </div>
            
            <div class="stats-grid">
              <div class="stat-card primary">
                <h3>Taxa de Recorrência</h3>
                <div class="value">${analiseRecorrencia.taxaRecorrencia}%</div>
              </div>
              <div class="stat-card success">
                <h3>Pacientes Recorrentes</h3>
                <div class="value">${analiseRecorrencia.recorrentes.quantidade}</div>
              </div>
              <div class="stat-card blue">
                <h3>Pacientes Novos</h3>
                <div class="value">${analiseRecorrencia.novos.quantidade}</div>
              </div>
              <div class="stat-card warning">
                <h3>Média de Visitas</h3>
                <div class="value">${analiseRecorrencia.mediaVisitasPorRecorrente}</div>
              </div>
            </div>

            <div class="section">
              <h2>💰 Análise Financeira</h2>
              <table>
                <tr>
                  <th>Métrica</th>
                  <th>Recorrentes</th>
                  <th>Novos</th>
                </tr>
                <tr>
                  <td>Valor Total</td>
                  <td>${formatCurrency(analiseRecorrencia.recorrentes.valor)}</td>
                  <td>${formatCurrency(analiseRecorrencia.novos.valor)}</td>
                </tr>
                <tr>
                  <td>Ticket Médio</td>
                  <td>${formatCurrency(analiseRecorrencia.recorrentes.ticketMedio)}</td>
                  <td>${formatCurrency(analiseRecorrencia.novos.ticketMedio)}</td>
                </tr>
                <tr>
                  <td>Taxa de Conversão</td>
                  <td>${analiseRecorrencia.recorrentes.taxaConversao}%</td>
                  <td>${analiseRecorrencia.novos.taxaConversao}%</td>
                </tr>
              </table>
            </div>

            <div class="section">
              <h2>🏆 Top 10 Pacientes Recorrentes</h2>
              <table>
                <tr>
                  <th>#</th>
                  <th>Paciente</th>
                  <th>Visitas</th>
                  <th>Primeira Visita</th>
                  <th>Última Visita</th>
                  <th>Valor Total</th>
                </tr>
                ${topRecorrentes.map((lead, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${lead.nome_paciente || 'N/A'}</td>
                    <td>${lead.total_visitas || 0}</td>
                    <td>${formatDate(lead.primeira_visita)}</td>
                    <td>${formatDate(lead.ultima_visita)}</td>
                    <td>${formatCurrency(lead.valor_total_visitas || lead.valor_orcado)}</td>
                  </tr>
                `).join('')}
              </table>
            </div>

            <div class="section">
              <h2>👨‍⚕️ Recorrência por Médico</h2>
              <table>
                <tr>
                  <th>Médico</th>
                  <th>Total de Pacientes</th>
                  <th>Recorrentes</th>
                  <th>Taxa de Recorrência</th>
                  <th>Valor Acumulado</th>
                </tr>
                ${recorrenciaPorMedico.map(medico => `
                  <tr>
                    <td>${medico.nome}</td>
                    <td>${medico.total}</td>
                    <td>${medico.recorrentes}</td>
                    <td>${medico.taxaRecorrencia}%</td>
                    <td>${formatCurrency(medico.valorRecorrentes)}</td>
                  </tr>
                `).join('')}
              </table>
            </div>

            <div class="footer">
              <p><strong>Relatório gerado automaticamente pelo Sistema YouNV</strong></p>
              <p>© ${new Date().getFullYear()} YouNV - Gestão de Leads e Pacientes</p>
            </div>
          </body>
        </html>
      `)

            printWindow.document.close()

            setTimeout(() => {
                printWindow.focus()
                printWindow.print()
            }, 500)
        } catch (error) {
            console.error('Erro ao gerar relatório:', error)
            alert('Erro ao gerar relatório.')
        }
    }

    // Exportar para XLSX
    const handleExportXLSX = () => {
        try {
            const wb = XLSX.utils.book_new()

            // --- Aba 1: Resumo Geral ---
            const resumoData = [
                ['Relatório de Recorrentes - Resumo Geral'],
                ['Gerado em:', new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
                [],
                ['Métrica', 'Valor'],
                ['Total de Pacientes', analiseRecorrencia.total],
                ['Pacientes Recorrentes', analiseRecorrencia.recorrentes.quantidade],
                ['Pacientes Novos', analiseRecorrencia.novos.quantidade],
                ['Taxa de Recorrência', `${analiseRecorrencia.taxaRecorrencia}%`],
                ['Média Dias entre Visitas', analiseRecorrencia.mediaDiasEntreVisitas || 'N/A'],
                ['Média Visitas/Paciente Recorrente', analiseRecorrencia.mediaVisitasPorRecorrente],
                ['Total de Visitas', analiseRecorrencia.totalVisitas],
                [],
                ['', 'Recorrentes', 'Novos'],
                ['Quantidade', analiseRecorrencia.recorrentes.quantidade, analiseRecorrencia.novos.quantidade],
                ['Valor Total', analiseRecorrencia.recorrentes.valor, analiseRecorrencia.novos.valor],
                ['Ticket Médio', analiseRecorrencia.recorrentes.ticketMedio, analiseRecorrencia.novos.ticketMedio],
                ['Convertidos', analiseRecorrencia.recorrentes.convertidos, analiseRecorrencia.novos.convertidos],
                ['Taxa de Conversão', `${analiseRecorrencia.recorrentes.taxaConversao}%`, `${analiseRecorrencia.novos.taxaConversao}%`],
            ]
            const wsResumo = XLSX.utils.aoa_to_sheet(resumoData)
            wsResumo['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 20 }]
            XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Geral')

            // --- Aba 2: Top Recorrentes ---
            const topRecorrentesData = [
                ['#', 'Paciente', 'Telefone', 'Visitas', '1ª Visita', 'Última Visita', 'Freq. (dias)', 'Valor Visitas', 'Valor Produtos', 'Total Gasto', 'Ticket/Visita'],
                ...topRecorrentes.map((lead, index) => {
                    const valorVisitas = lead.valor_total_visitas || 0
                    const valorProdutos = lead.total_gasto_produtos || 0
                    const totalGasto = lead.valor_total_gasto || (valorVisitas + valorProdutos) || lead.valor_orcado || 0
                    const ticketPorVisita = (lead.total_visitas || 0) > 0 ? valorVisitas / lead.total_visitas : 0
                    return [
                        index + 1,
                        lead.nome_paciente || 'N/A',
                        lead.telefone || '',
                        lead.total_visitas || 0,
                        formatDate(lead.primeira_visita || lead.data_registro_contato),
                        formatDate(lead.ultima_visita),
                        lead.media_dias_entre_visitas || 'N/A',
                        valorVisitas,
                        valorProdutos,
                        totalGasto,
                        ticketPorVisita
                    ]
                })
            ]
            const wsTop = XLSX.utils.aoa_to_sheet(topRecorrentesData)
            wsTop['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 16 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 14 }]
            XLSX.utils.book_append_sheet(wb, wsTop, 'Top Recorrentes')

            // --- Aba: Passagens do Período (sem o corte de 100 linhas da tela) ---
            const passagensData = [
                ['Data', 'Paciente', 'Telefone', 'Médico', 'Especialidade', 'Tipo', 'Status', 'Registrado por', 'Próximo Contato', 'Valor', 'Observações'],
                ...passagensPeriodo.linhas.map(({ lead, visita }) => [
                    visita.data_visita ? parseLocalDate(visita.data_visita).toLocaleDateString('pt-BR') : 'N/A',
                    lead.nome_paciente || 'N/A',
                    lead.telefone || '',
                    visita.medico_nome || 'N/A',
                    visita.especialidade_nome || '',
                    visita.tipo_visita || 'Consulta',
                    visita.status || '',
                    visita.registrado_por_nome || '',
                    visita.data_proximo_contato ? parseLocalDate(visita.data_proximo_contato).toLocaleDateString('pt-BR') : '',
                    parseFloat(visita.valor) || 0,
                    visita.observacoes || ''
                ])
            ]
            const wsPassagens = XLSX.utils.aoa_to_sheet(passagensData)
            wsPassagens['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 15 }, { wch: 12 }, { wch: 50 }]
            XLSX.utils.book_append_sheet(wb, wsPassagens, 'Passagens')

            // --- Aba: Conversões por Usuário ---
            const usuariosData = [
                ['Usuário', 'Passagens Registradas', 'Convertidas', 'Taxa', 'Valor Convertido'],
                ...conversoesPorUsuario.map(u => [
                    u.nome,
                    u.passagens,
                    u.convertidas,
                    `${u.passagens > 0 ? ((u.convertidas / u.passagens) * 100).toFixed(0) : 0}%`,
                    u.valorConvertidas
                ])
            ]
            const wsUsuarios = XLSX.utils.aoa_to_sheet(usuariosData)
            wsUsuarios['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 18 }]
            XLSX.utils.book_append_sheet(wb, wsUsuarios, 'Conversões por Usuário')

            // --- Aba 3: Evolução Mensal ---
            const mensalData = [
                ['Mês', 'Novos', 'Recorrentes', 'Valor Novos', 'Valor Recorrentes'],
                ...analiseMenual.map(m => [m.mes, m.novos, m.recorrentes, m.valorNovos, m.valorRecorrentes])
            ]
            const wsMensal = XLSX.utils.aoa_to_sheet(mensalData)
            wsMensal['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 18 }]
            XLSX.utils.book_append_sheet(wb, wsMensal, 'Evolução Mensal')

            // --- Aba 4: Recorrência por Médico ---
            const medicoData = [
                ['Médico', 'Total Pacientes', 'Total Visitas', 'Recorrentes', 'Taxa Recorrência', 'Valor Acumulado'],
                ...recorrenciaPorMedico.map(m => [
                    m.nome, m.total, m.visitas, m.recorrentes, `${m.taxaRecorrencia}%`, m.valorRecorrentes
                ])
            ]
            const wsMedico = XLSX.utils.aoa_to_sheet(medicoData)
            wsMedico['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }]
            XLSX.utils.book_append_sheet(wb, wsMedico, 'Recorrência por Médico')

            // --- Aba 5: Ranking Médicos Performance ---
            const rankMedicosData = [
                ['#', 'Médico', 'Leads', 'Convertidos', 'Taxa Conv.', 'Recorrentes', 'Taxa Recorr.', 'Receita Convertidos', 'Receita Recorrentes'],
                ...rankingMedicosPerformance.map((m, i) => [
                    i + 1, m.nome, m.totalLeads, m.convertidos, `${m.taxaConversao}%`, m.recorrentes, `${m.taxaRecorrencia}%`, m.receita, m.receitaRecorrentes
                ])
            ]
            const wsRankMedicos = XLSX.utils.aoa_to_sheet(rankMedicosData)
            wsRankMedicos['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 }]
            XLSX.utils.book_append_sheet(wb, wsRankMedicos, 'Ranking Médicos')

            // --- Aba 6: Ranking Canais ---
            const rankCanaisData = [
                ['#', 'Canal', 'Leads', 'Convertidos', 'Taxa Conv.', 'Recorrentes', 'Taxa Recorr.', 'Receita'],
                ...rankingCanaisPerformance.map((c, i) => [
                    i + 1, c.nome, c.totalLeads, c.convertidos, `${c.taxaConversao}%`, c.recorrentes, `${c.taxaRecorrencia}%`, c.receita
                ])
            ]
            const wsRankCanais = XLSX.utils.aoa_to_sheet(rankCanaisData)
            wsRankCanais['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }]
            XLSX.utils.book_append_sheet(wb, wsRankCanais, 'Ranking Canais')

            // --- Aba 7: Ranking Especialidades ---
            const rankEspData = [
                ['#', 'Especialidade', 'Leads', 'Convertidos', 'Taxa Conv.', 'Recorrentes', 'Taxa Recorr.', 'Receita'],
                ...rankingEspecialidades.map((e, i) => [
                    i + 1, e.nome, e.totalLeads, e.convertidos, `${e.taxaConversao}%`, e.recorrentes, `${e.taxaRecorrencia}%`, e.receita
                ])
            ]
            const wsRankEsp = XLSX.utils.aoa_to_sheet(rankEspData)
            wsRankEsp['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }]
            XLSX.utils.book_append_sheet(wb, wsRankEsp, 'Ranking Especialidades')

            // --- Aba 8: Retenção e Frequência ---
            const retencaoData = [
                ['Análise de Retenção (Dias desde última visita)'],
                ['Categoria', 'Quantidade'],
                ...analiseRetencao.map(r => [r.categoria, r.quantidade]),
                [],
                ['Frequência de Visitas'],
                ['Categoria', 'Quantidade'],
                ...analiseFrequencia.map(f => [f.categoria, f.quantidade]),
            ]
            const wsRetencao = XLSX.utils.aoa_to_sheet(retencaoData)
            wsRetencao['!cols'] = [{ wch: 25 }, { wch: 14 }]
            XLSX.utils.book_append_sheet(wb, wsRetencao, 'Retenção e Frequência')

            // --- Aba 9: Pacientes Inativos ---
            const inativosRows = []
            inativosRows.push(['Pacientes Inativos'])
            inativosRows.push(['Categoria', 'Paciente', 'Telefone', 'Email', 'Dias s/ Visita', 'Última Visita', 'Status', 'Valor'])
            Object.entries(pacientesInativos).forEach(([categoria, lista]) => {
                lista.forEach(lead => {
                    inativosRows.push([
                        categoria,
                        lead.nome_paciente || 'N/A',
                        lead.telefone || '',
                        lead.email || '',
                        lead.diasSemVisita,
                        formatDate(lead.ultima_visita),
                        lead.status || 'Lead',
                        lead.valor_total_visitas || lead.valor_orcado || 0
                    ])
                })
            })
            if (inativosRows.length > 2) {
                const wsInativos = XLSX.utils.aoa_to_sheet(inativosRows)
                wsInativos['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
                XLSX.utils.book_append_sheet(wb, wsInativos, 'Pacientes Inativos')
            }

            // Gerar e baixar o arquivo
            const dataHoje = new Date().toISOString().slice(0, 10)
            XLSX.writeFile(wb, `Relatorio_Recorrentes_${dataHoje}.xlsx`)
        } catch (error) {
            console.error('Erro ao exportar XLSX:', error)
            alert('Erro ao exportar relatório. Tente novamente.')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Carregando relatório de recorrentes...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6" ref={reportRef}>
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Repeat className="h-6 w-6 text-purple-600" />
                        Relatório de Recorrentes
                    </h1>
                    <p className="text-gray-600">Análise detalhada de pacientes recorrentes e fidelização</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={activeTab === 'crosscheck' ? handleExportCrosscheckXLSX : handleExportXLSX}
                        variant="default"
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar XLSX
                    </Button>
                    <Button
                        onClick={handlePrint}
                        variant="default"
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir
                    </Button>
                    <Button
                        onClick={() => setShowPeriodFilter(!showPeriodFilter)}
                        variant={showPeriodFilter ? "default" : "outline"}
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        Filtros
                    </Button>
                    <Button
                        onClick={loadData}
                        variant="outline"
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Atualizar
                    </Button>
                </div>
            </div>

            {/* Filtros */}
            {showPeriodFilter && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filtros
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Data Inicial</label>
                                <Input
                                    type="date"
                                    value={periodFilter.startDate}
                                    onChange={(e) => setPeriodFilter({ ...periodFilter, startDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Data Final</label>
                                <Input
                                    type="date"
                                    value={periodFilter.endDate}
                                    onChange={(e) => setPeriodFilter({ ...periodFilter, endDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">Filtrar por:</span>
                                  <button
                                    onClick={() => setDateFilterType('registro')}
                                    className={`px-2 py-1 rounded text-xs ${dateFilterType === 'registro' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-500'}`}
                                  >
                                    Data de Registro
                                  </button>
                                  <button
                                    onClick={() => setDateFilterType('consulta')}
                                    className={`px-2 py-1 rounded text-xs ${dateFilterType === 'consulta' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-500'}`}
                                  >
                                    Data da Consulta
                                  </button>
                                  <button
                                    onClick={() => setDateFilterType('passagem')}
                                    className={`px-2 py-1 rounded text-xs ${dateFilterType === 'passagem' ? 'bg-purple-100 text-purple-800 font-medium' : 'text-gray-500'}`}
                                    title="Inclui o paciente se qualquer passagem dele cair no período"
                                  >
                                    Data da Passagem
                                  </button>
                                </div>
                                {dateFilterType === 'passagem' && (
                                    <p className="text-xs text-purple-600">
                                        O período olha as datas das passagens registradas: um paciente
                                        antigo que passou pela clínica no período entra no relatório.
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500">Especialidade</label>
                                <Select value={selectedEspecialidadeFilter} onValueChange={setSelectedEspecialidadeFilter}>
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Todas" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todas as especialidades</SelectItem>
                                    {especialidades && especialidades.filter(e => e.ativo !== false).map(e => (
                                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500">Usuário (registrou a passagem)</label>
                                <Select value={selectedUsuario} onValueChange={setSelectedUsuario}>
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Todos" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="todos">Todos os usuários</SelectItem>
                                    {usuariosComPassagem.map(nome => (
                                      <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-[10px] text-gray-400">
                                    Filtra o relatório inteiro pelos pacientes que esta pessoa atendeu
                                </p>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium flex items-center justify-between">
                                    <span>Médicos</span>
                                    {selectedMedicos.length > 0 && (
                                        <Badge className="bg-purple-100 text-purple-800">
                                            {selectedMedicos.length} selecionado(s)
                                        </Badge>
                                    )}
                                </label>
                                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 bg-white">
                                    <div className="space-y-2">
                                        {medicos.map(medico => (
                                            <label
                                                key={medico.id}
                                                className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${selectedMedicos.includes(medico.id) ? 'bg-purple-50 border border-purple-200' : ''
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMedicos.includes(medico.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedMedicos([...selectedMedicos, medico.id])
                                                        } else {
                                                            setSelectedMedicos(selectedMedicos.filter(id => id !== medico.id))
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                />
                                                <span className="text-sm">{medico.nome}</span>
                                            </label>
                                        ))}
                                        {medicos.length === 0 && (
                                            <p className="text-sm text-gray-500 text-center py-2">Nenhum médico cadastrado</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2 flex items-end md:col-span-2">
                                <Button variant="outline" onClick={clearFilters} className="w-full">
                                    Limpar Filtros
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* === Tabs: Recorrentes vs Crosscheck === */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="recorrentes" className="flex items-center gap-2">
                        <Repeat className="h-4 w-4" />
                        Recorrentes
                    </TabsTrigger>
                    <TabsTrigger value="crosscheck" className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Crosscheck
                        {analiseCrosscheck.length > 0 && (
                            <Badge className="ml-1 bg-red-100 text-red-700">{analiseCrosscheck.length}</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="recorrentes" className="space-y-6 mt-4">
            {/* Cards de Métricas Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card
                    className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => viewCategoryDetails('Recorrentes', 'recorrentes')}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-purple-700 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Target className="h-4 w-4" />
                                Taxa de Recorrência
                            </span>
                            <Eye className="h-4 w-4 text-purple-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-purple-600">
                            {analiseRecorrencia.taxaRecorrencia}%
                        </div>
                        <p className="text-xs text-purple-500 mt-1">
                            {analiseRecorrencia.recorrentes.quantidade} de {analiseRecorrencia.total} pacientes retornaram
                        </p>
                    </CardContent>
                </Card>

                <Card
                    className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => viewCategoryDetails('Recorrentes', 'recorrentes')}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-700 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <UserCheck className="h-4 w-4" />
                                Pacientes Recorrentes
                            </span>
                            <Eye className="h-4 w-4 text-green-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">
                            {analiseRecorrencia.recorrentes.quantidade}
                        </div>
                        <div className="flex items-center text-xs text-green-500 mt-1">
                            <ArrowUpRight className="h-3 w-3 mr-1" />
                            {formatCurrency(analiseRecorrencia.recorrentes.valor)} em receita
                        </div>
                    </CardContent>
                </Card>

                <Card
                    className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => viewCategoryDetails('Novos', 'novos')}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-700 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <UserPlus className="h-4 w-4" />
                                Pacientes Novos
                            </span>
                            <Eye className="h-4 w-4 text-blue-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">
                            {analiseRecorrencia.novos.quantidade}
                        </div>
                        <div className="flex items-center text-xs text-blue-500 mt-1">
                            {formatCurrency(analiseRecorrencia.novos.valor)} em receita
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Frequência Média
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-orange-600">
                            {analiseRecorrencia.mediaDiasEntreVisitas > 0
                                ? `${analiseRecorrencia.mediaDiasEntreVisitas}d`
                                : 'N/A'
                            }
                        </div>
                        <p className="text-xs text-orange-500 mt-1">
                            entre visitas • {analiseRecorrencia.mediaVisitasPorRecorrente} visitas/paciente
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Cards de Comparação Financeira */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            Comparativo Financeiro
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                                    <p className="text-sm font-medium text-green-700 mb-2">Recorrentes</p>
                                    <p className="text-2xl font-bold text-green-600">{formatCurrency(analiseRecorrencia.recorrentes.valor)}</p>
                                    <p className="text-xs text-green-500 mt-1">
                                        Ticket médio: {formatCurrency(analiseRecorrencia.recorrentes.ticketMedio)}
                                    </p>
                                </div>
                                <div className="text-center">
                                    <Badge className="bg-green-100 text-green-800">
                                        {analiseRecorrencia.recorrentes.taxaConversao}% converteram
                                    </Badge>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-sm font-medium text-blue-700 mb-2">Novos</p>
                                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(analiseRecorrencia.novos.valor)}</p>
                                    <p className="text-xs text-blue-500 mt-1">
                                        Ticket médio: {formatCurrency(analiseRecorrencia.novos.ticketMedio)}
                                    </p>
                                </div>
                                <div className="text-center">
                                    <Badge className="bg-blue-100 text-blue-800">
                                        {analiseRecorrencia.novos.taxaConversao}% converteram
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Activity className="h-5 w-5 text-purple-600" />
                            Distribuição de Pacientes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Gráfico de Evolução Mensal */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-purple-600" />
                        Evolução Mensal: Novos vs Recorrentes
                    </CardTitle>
                    <CardDescription>Últimos 12 meses</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={analiseMenual}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip
                                formatter={(value, name) => {
                                    const label = name === 'novos' ? 'Pacientes Novos' : 'Pacientes Recorrentes'
                                    return [value, label]
                                }}
                                labelFormatter={(label) => `Período: ${label}`}
                            />
                            <Legend
                                formatter={(value) => {
                                    if (value === 'novos') return 'Pacientes Novos'
                                    if (value === 'recorrentes') return 'Pacientes Recorrentes'
                                    return value
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="novos"
                                name="novos"
                                stackId="1"
                                stroke="#3b82f6"
                                fill="#3b82f680"
                            />
                            <Area
                                type="monotone"
                                dataKey="recorrentes"
                                name="recorrentes"
                                stackId="1"
                                stroke="#10b981"
                                fill="#10b98180"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Análise de Retenção e Frequência */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="h-5 w-5 text-orange-600" />
                            Análise de Retenção
                        </CardTitle>
                        <CardDescription>Dias desde a última visita</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={analiseRetencao} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="categoria" type="category" width={120} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar
                                    dataKey="quantidade"
                                    fill="#f59e0b"
                                    radius={[0, 4, 4, 0]}
                                    onClick={(data) => viewCategoryDetails(data.categoria, 'retencao')}
                                    cursor="pointer"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Repeat className="h-5 w-5 text-purple-600" />
                            Frequência de Visitas
                        </CardTitle>
                        <CardDescription>Quantidade de visitas por paciente</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={analiseFrequencia}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="categoria" tick={{ fontSize: 11 }} />
                                <YAxis />
                                <Tooltip />
                                <Bar
                                    dataKey="quantidade"
                                    radius={[4, 4, 0, 0]}
                                    onClick={(data) => viewCategoryDetails(data.categoria, 'frequencia')}
                                    cursor="pointer"
                                >
                                    {analiseFrequencia.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Alertas de Pacientes Inativos */}
            {(pacientesInativos['30-60 dias'].length > 0 ||
                pacientesInativos['61-90 dias'].length > 0 ||
                pacientesInativos['91-180 dias'].length > 0 ||
                pacientesInativos['Mais de 180 dias'].length > 0) && (
                    <Card className="border-orange-200 bg-orange-50/50">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
                                <Clock className="h-5 w-5" />
                                ⚠️ Alertas: Pacientes Sem Retorno
                            </CardTitle>
                            <CardDescription>
                                Pacientes que não visitam a clínica há algum tempo - clique para ver detalhes
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${pacientesInativos['30-60 dias'].length > 0
                                        ? 'bg-yellow-50 border-yellow-300 hover:border-yellow-400'
                                        : 'bg-gray-50 border-gray-200'
                                        }`}
                                    onClick={() => {
                                        if (pacientesInativos['30-60 dias'].length > 0) {
                                            setSelectedCategory({ name: '30-60 dias sem visita', type: 'inativos' })
                                            setCategoryLeads(pacientesInativos['30-60 dias'])
                                            setShowLeadDetails(true)
                                        }
                                    }}
                                >
                                    <div className="text-center">
                                        <p className="text-3xl font-bold text-yellow-600">
                                            {pacientesInativos['30-60 dias'].length}
                                        </p>
                                        <p className="text-sm text-yellow-700 font-medium">30-60 dias</p>
                                        <p className="text-xs text-gray-500">sem visita</p>
                                    </div>
                                </div>

                                <div
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${pacientesInativos['61-90 dias'].length > 0
                                        ? 'bg-orange-50 border-orange-300 hover:border-orange-400'
                                        : 'bg-gray-50 border-gray-200'
                                        }`}
                                    onClick={() => {
                                        if (pacientesInativos['61-90 dias'].length > 0) {
                                            setSelectedCategory({ name: '61-90 dias sem visita', type: 'inativos' })
                                            setCategoryLeads(pacientesInativos['61-90 dias'])
                                            setShowLeadDetails(true)
                                        }
                                    }}
                                >
                                    <div className="text-center">
                                        <p className="text-3xl font-bold text-orange-600">
                                            {pacientesInativos['61-90 dias'].length}
                                        </p>
                                        <p className="text-sm text-orange-700 font-medium">61-90 dias</p>
                                        <p className="text-xs text-gray-500">sem visita</p>
                                    </div>
                                </div>

                                <div
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${pacientesInativos['91-180 dias'].length > 0
                                        ? 'bg-red-50 border-red-300 hover:border-red-400'
                                        : 'bg-gray-50 border-gray-200'
                                        }`}
                                    onClick={() => {
                                        if (pacientesInativos['91-180 dias'].length > 0) {
                                            setSelectedCategory({ name: '91-180 dias sem visita', type: 'inativos' })
                                            setCategoryLeads(pacientesInativos['91-180 dias'])
                                            setShowLeadDetails(true)
                                        }
                                    }}
                                >
                                    <div className="text-center">
                                        <p className="text-3xl font-bold text-red-500">
                                            {pacientesInativos['91-180 dias'].length}
                                        </p>
                                        <p className="text-sm text-red-600 font-medium">91-180 dias</p>
                                        <p className="text-xs text-gray-500">sem visita</p>
                                    </div>
                                </div>

                                <div
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${pacientesInativos['Mais de 180 dias'].length > 0
                                        ? 'bg-red-100 border-red-400 hover:border-red-500'
                                        : 'bg-gray-50 border-gray-200'
                                        }`}
                                    onClick={() => {
                                        if (pacientesInativos['Mais de 180 dias'].length > 0) {
                                            setSelectedCategory({ name: 'Mais de 180 dias sem visita', type: 'inativos' })
                                            setCategoryLeads(pacientesInativos['Mais de 180 dias'])
                                            setShowLeadDetails(true)
                                        }
                                    }}
                                >
                                    <div className="text-center">
                                        <p className="text-3xl font-bold text-red-700">
                                            {pacientesInativos['Mais de 180 dias'].length}
                                        </p>
                                        <p className="text-sm text-red-800 font-medium">+180 dias</p>
                                        <p className="text-xs text-gray-500">sem visita ⚠️</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 text-center text-sm text-gray-500">
                                Total de pacientes sem retorno: {
                                    pacientesInativos['30-60 dias'].length +
                                    pacientesInativos['61-90 dias'].length +
                                    pacientesInativos['91-180 dias'].length +
                                    pacientesInativos['Mais de 180 dias'].length
                                } - Clique em cada categoria para ver a lista completa
                            </div>
                        </CardContent>
                    </Card>
                )}

            {/* Passagens do período — uma linha por visita. Sem esta lista, a única
                visão de pacientes era o Top 10 por contagem, e uma passagem
                registrada hoje não aparecia em lugar nenhum do relatório. */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5 text-purple-600" />
                        Passagens no Período ({passagensPeriodo.linhas.length})
                    </CardTitle>
                    <CardDescription>
                        {(periodFilter.startDate || periodFilter.endDate)
                            ? `${passagensPeriodo.pacientesUnicos} paciente(s) • ${formatCurrency(passagensPeriodo.valorTotal)} em passagens no período`
                            : `Todas as passagens registradas (${passagensPeriodo.pacientesUnicos} pacientes) — defina um período acima para ver um dia específico`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Busca por paciente: o total do título vira o resumo dele —
                        "quantas passagens a Fulana teve?" em uma digitada */}
                    <div className="relative mb-3 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            value={buscaPacientePassagens}
                            onChange={(e) => setBuscaPacientePassagens(e.target.value)}
                            placeholder="Buscar paciente por nome ou telefone..."
                            className="h-9 pl-9"
                        />
                        {buscaPacientePassagens && (
                            <button
                                type="button"
                                onClick={() => setBuscaPacientePassagens('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                                title="Limpar busca"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    {passagensPeriodo.linhas.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p>
                                {buscaPacientePassagens.trim()
                                    ? `Nenhuma passagem encontrada para "${buscaPacientePassagens.trim()}"`
                                    : 'Nenhuma passagem registrada no período'}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Paciente</TableHead>
                                        <TableHead>Telefone</TableHead>
                                        <TableHead>Médico</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Registrado por</TableHead>
                                        <TableHead>Próx. Contato</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {passagensPeriodo.linhas.slice(0, 100).map(({ lead, visita }) => (
                                        <TableRow key={`${lead.id}-${visita.id}`}>
                                            <TableCell className="text-sm whitespace-nowrap">
                                                {visita.data_visita ? parseLocalDate(visita.data_visita).toLocaleDateString('pt-BR') : 'N/A'}
                                            </TableCell>
                                            <TableCell className="font-medium">{lead.nome_paciente}</TableCell>
                                            <TableCell className="text-sm">{lead.telefone}</TableCell>
                                            <TableCell className="text-sm">{visita.medico_nome || 'N/A'}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {visita.tipo_visita || 'Consulta'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={STATUS_COLORS[visita.status] || STATUS_VISITA_COLORS[visita.status] || 'bg-gray-100 text-gray-800'}>
                                                    {visita.status || '—'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600">
                                                {visita.registrado_por_nome || '—'}
                                            </TableCell>
                                            <TableCell className="text-sm whitespace-nowrap">
                                                {visita.data_proximo_contato
                                                    ? <span className="text-blue-600 font-medium">{parseLocalDate(visita.data_proximo_contato).toLocaleDateString('pt-BR')}</span>
                                                    : <span className="text-gray-400">—</span>}
                                            </TableCell>
                                            <TableCell className="text-right text-sm font-medium text-green-600">
                                                {formatCurrency(visita.valor)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {passagensPeriodo.linhas.length > 100 && (
                                <p className="text-xs text-gray-500 text-center py-2">
                                    Mostrando as 100 passagens mais recentes de {passagensPeriodo.linhas.length} — refine o período para ver as demais
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quem da equipe está convertendo — agrupado pelo usuário que
                registrou cada passagem do período acima */}
            {conversoesPorUsuario.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <UserCheck className="h-5 w-5 text-purple-600" />
                            Conversões por Usuário
                        </CardTitle>
                        <CardDescription>
                            Usuário do sistema que registrou cada passagem do período — o médico da visita está na lista acima
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuário</TableHead>
                                        <TableHead className="text-center">Passagens Registradas</TableHead>
                                        <TableHead className="text-center">Convertidas</TableHead>
                                        <TableHead className="text-center">Taxa</TableHead>
                                        <TableHead className="text-right">Valor Convertido</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {conversoesPorUsuario.map(u => (
                                        <TableRow key={u.nome}>
                                            <TableCell className="font-medium">{u.nome}</TableCell>
                                            <TableCell className="text-center">{u.passagens}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={u.convertidas > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                                                    {u.convertidas}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center text-sm text-gray-600">
                                                {u.passagens > 0 ? ((u.convertidas / u.passagens) * 100).toFixed(0) : 0}%
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-green-600">
                                                {formatCurrency(u.valorConvertidas)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Top Pacientes Recorrentes */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-5 w-5 text-purple-600" />
                        Top 10 Pacientes Mais Recorrentes
                    </CardTitle>
                    <CardDescription>Pacientes com maior número de visitas</CardDescription>
                </CardHeader>
                <CardContent>
                    {topRecorrentes.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p>Nenhum paciente recorrente encontrado</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>Paciente</TableHead>
                                        <TableHead>Telefone</TableHead>
                                        <TableHead className="text-center">Visitas</TableHead>
                                        <TableHead>1a Visita</TableHead>
                                        <TableHead>Última Visita</TableHead>
                                        <TableHead>Freq.</TableHead>
                                        <TableHead className="text-right">Valor Visitas</TableHead>
                                        <TableHead className="text-right">Valor Produtos</TableHead>
                                        <TableHead className="text-right">Total Gasto</TableHead>
                                        <TableHead className="text-right">Ticket/Visita</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {topRecorrentes.map((lead, index) => {
                                        const valorVisitas = lead.valor_total_visitas || 0
                                        const valorProdutos = lead.total_gasto_produtos || 0
                                        const totalGasto = lead.valor_total_gasto || (valorVisitas + valorProdutos) || lead.valor_orcado || 0
                                        const ticketPorVisita = (lead.total_visitas || 0) > 0 ? valorVisitas / lead.total_visitas : 0
                                        return (
                                            <TableRow key={lead.id}>
                                                <TableCell>
                                                    <Badge className={`${index === 0 ? 'bg-amber-100 text-amber-800' : index === 1 ? 'bg-gray-200 text-gray-800' : index === 2 ? 'bg-amber-50 text-amber-700' : 'bg-purple-100 text-purple-800'}`}>
                                                        #{index + 1}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">{lead.nome_paciente}</TableCell>
                                                <TableCell className="text-sm">{lead.telefone}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className="bg-green-100 text-green-800 text-sm">
                                                        {lead.total_visitas || 0}x
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">{formatDate(lead.primeira_visita || lead.data_registro_contato)}</TableCell>
                                                <TableCell className="text-sm">{formatDate(lead.ultima_visita)}</TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-blue-600 font-medium">
                                                        {lead.media_dias_entre_visitas ? `${lead.media_dias_entre_visitas}d` : 'N/A'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right text-sm font-medium text-green-600">
                                                    {formatCurrency(valorVisitas)}
                                                </TableCell>
                                                <TableCell className="text-right text-sm font-medium text-blue-600">
                                                    {formatCurrency(valorProdutos)}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-emerald-700">
                                                    {formatCurrency(totalGasto)}
                                                </TableCell>
                                                <TableCell className="text-right text-sm text-purple-600">
                                                    {formatCurrency(ticketPorVisita)}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recorrência por Médico */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Stethoscope className="h-5 w-5 text-blue-600" />
                        Taxa de Recorrência por Médico
                    </CardTitle>
                    <CardDescription>Médicos com maior taxa de retorno de pacientes</CardDescription>
                </CardHeader>
                <CardContent>
                    {recorrenciaPorMedico.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Stethoscope className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p>Nenhum dado disponível</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={recorrenciaPorMedico}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="nome" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                                <YAxis />
                                <Tooltip
                                    formatter={(value, name) => {
                                        if (name === 'recorrentes') return [value, 'Recorrentes']
                                        if (name === 'total') return [value, 'Total Pacientes']
                                        return [value, name]
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="total" name="Total" fill="#3b82f680" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="recorrentes" name="Recorrentes" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* ==========================================
                SEÇÃO: PERFORMANCE POR INDICADOR E RANKING
                ========================================== */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-600" />
                    Performance por Indicador e Ranking
                </h2>

                {/* Ranking por Médico */}
                <Card className="mb-4">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Stethoscope className="h-5 w-5 text-purple-600" />
                            Ranking de Médicos — Volume e Conversão
                        </CardTitle>
                        <CardDescription>Performance completa por médico com taxa de conversão e recorrência</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {rankingMedicosPerformance.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">Nenhum dado disponível</p>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>#</TableHead>
                                            <TableHead>Médico</TableHead>
                                            <TableHead className="text-center">Leads</TableHead>
                                            <TableHead className="text-center">Convertidos</TableHead>
                                            <TableHead className="text-center">Taxa Conv.</TableHead>
                                            <TableHead className="text-center">Recorrentes</TableHead>
                                            <TableHead className="text-center">Taxa Recorr.</TableHead>
                                            <TableHead className="text-right">Receita Conv.</TableHead>
                                            <TableHead className="text-right">Receita Recorr.</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rankingMedicosPerformance.map((medico, index) => (
                                            <TableRow key={index} className={index < 3 ? 'bg-amber-50/50' : ''}>
                                                <TableCell>
                                                    <Badge className={`${index === 0 ? 'bg-amber-500 text-white' : index === 1 ? 'bg-gray-400 text-white' : index === 2 ? 'bg-amber-700 text-white' : 'bg-gray-200 text-gray-700'}`}>
                                                        #{index + 1}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">{medico.nome}</TableCell>
                                                <TableCell className="text-center font-bold">{medico.totalLeads}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className="bg-green-100 text-green-800">{medico.convertidos}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={`${parseFloat(medico.taxaConversao) >= 50 ? 'bg-green-100 text-green-800' : parseFloat(medico.taxaConversao) >= 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                        {medico.taxaConversao}%
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className="bg-purple-100 text-purple-800">{medico.recorrentes}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={`${parseFloat(medico.taxaRecorrencia) >= 30 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'}`}>
                                                        {medico.taxaRecorrencia}%
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-green-600">{formatCurrency(medico.receita)}</TableCell>
                                                <TableCell className="text-right font-semibold text-purple-600">{formatCurrency(medico.receitaRecorrentes)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Rankings lado a lado: Canal e Especialidade */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Ranking por Canal */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Zap className="h-5 w-5 text-blue-600" />
                                Ranking por Canal de Contato
                            </CardTitle>
                            <CardDescription>Volume e conversão por canal</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {rankingCanaisPerformance.map((canal, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-blue-400' : index === 2 ? 'bg-blue-300' : 'bg-gray-300'}`}>
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{canal.nome}</p>
                                                <p className="text-xs text-gray-500">{canal.totalLeads} leads | {canal.recorrentes} recorrentes</p>
                                            </div>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="flex items-center gap-1 justify-end">
                                                <Badge className={`text-xs ${parseFloat(canal.taxaConversao) >= 50 ? 'bg-green-100 text-green-800' : parseFloat(canal.taxaConversao) >= 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                    {canal.taxaConversao}% conv.
                                                </Badge>
                                                <Badge className="text-xs bg-purple-100 text-purple-800">
                                                    {canal.taxaRecorrencia}% rec.
                                                </Badge>
                                            </div>
                                            <p className="text-xs font-semibold text-green-600">{formatCurrency(canal.receita)}</p>
                                        </div>
                                    </div>
                                ))}
                                {rankingCanaisPerformance.length === 0 && (
                                    <p className="text-center text-gray-500 py-4">Nenhum dado</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Ranking por Especialidade */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-emerald-600" />
                                Ranking por Especialidade
                            </CardTitle>
                            <CardDescription>Volume e conversão por especialidade</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {rankingEspecialidades.map((esp, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${index === 0 ? 'bg-emerald-500' : index === 1 ? 'bg-emerald-400' : index === 2 ? 'bg-emerald-300' : 'bg-gray-300'}`}>
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{esp.nome}</p>
                                                <p className="text-xs text-gray-500">{esp.totalLeads} leads | {esp.recorrentes} recorrentes</p>
                                            </div>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="flex items-center gap-1 justify-end">
                                                <Badge className={`text-xs ${parseFloat(esp.taxaConversao) >= 50 ? 'bg-green-100 text-green-800' : parseFloat(esp.taxaConversao) >= 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                    {esp.taxaConversao}% conv.
                                                </Badge>
                                                <Badge className="text-xs bg-purple-100 text-purple-800">
                                                    {esp.taxaRecorrencia}% rec.
                                                </Badge>
                                            </div>
                                            <p className="text-xs font-semibold text-green-600">{formatCurrency(esp.receita)}</p>
                                        </div>
                                    </div>
                                ))}
                                {rankingEspecialidades.length === 0 && (
                                    <p className="text-center text-gray-500 py-4">Nenhum dado</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

                </TabsContent>

                {/* === Aba: Crosscheck de Oportunidades === */}
                <TabsContent value="crosscheck" className="space-y-6 mt-4">

                    {/* KPIs do Crosscheck — Pattern A do Dashboard (sombra profunda + ícone branco em retângulo colorido) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-xl transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-700">
                                    Oportunidades
                                </CardTitle>
                                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                                    <Target className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-gray-900">{crosscheckKPIs.total}</div>
                                <p className="text-sm text-gray-600 mt-2 flex items-center">
                                    <Users className="h-4 w-4 text-purple-600 mr-1" />
                                    <span className="text-purple-600 font-medium">{crosscheckKPIs.pacientesUnicos} pacientes únicos</span>
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 hover:shadow-xl transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-700">
                                    Valor potencial
                                </CardTitle>
                                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                                    <DollarSign className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-gray-900">{formatCurrency(crosscheckKPIs.valorTotal)}</div>
                                <p className="text-sm text-gray-600 mt-2 flex items-center">
                                    <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                                    <span className="text-green-600 font-medium">soma de todas as oportunidades</span>
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100 hover:shadow-xl transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-700">
                                    Críticas
                                </CardTitle>
                                <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-gray-900">{crosscheckKPIs.criticas}</div>
                                <p className="text-sm text-gray-600 mt-2 flex items-center">
                                    <Activity className="h-4 w-4 text-red-600 mr-1" />
                                    <span className="text-red-600 font-medium">ação imediata recomendada</span>
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-xl transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-700">
                                    Alta urgência
                                </CardTitle>
                                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                                    <Clock className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-gray-900">{crosscheckKPIs.altas}</div>
                                <p className="text-sm text-gray-600 mt-2 flex items-center">
                                    <Calendar className="h-4 w-4 text-orange-600 mr-1" />
                                    <span className="text-orange-600 font-medium">priorizar esta semana</span>
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filtros locais do Crosscheck */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Filter className="h-4 w-4" />
                                Filtros do Crosscheck
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Buscar paciente</label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="Nome ou telefone..."
                                            value={crosscheckSearch}
                                            onChange={(e) => setCrosscheckSearch(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Urgência</label>
                                    <Select value={crosscheckUrgencyFilter} onValueChange={setCrosscheckUrgencyFilter}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas</SelectItem>
                                            <SelectItem value="critica">🔥 Crítica</SelectItem>
                                            <SelectItem value="alta">⚠️ Alta</SelectItem>
                                            <SelectItem value="media">⏱️ Média</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 flex items-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setCrosscheckSearch('')
                                            setCrosscheckCategoryFilter([])
                                            setCrosscheckUrgencyFilter('all')
                                        }}
                                        className="w-full"
                                    >
                                        Limpar filtros do Crosscheck
                                    </Button>
                                </div>
                            </div>

                            {/* Chips de categoria */}
                            <div>
                                <label className="text-sm font-medium block mb-2">Categorias ({crosscheckKPIs.breakdownCategoria.length})</label>
                                <div className="flex flex-wrap gap-2">
                                    {crosscheckKPIs.breakdownCategoria.map(b => {
                                        const meta = CROSSCHECK_CATEGORIAS[b.categoria]
                                        const ativo = crosscheckCategoryFilter.includes(b.categoria)
                                        return (
                                            <button
                                                key={b.categoria}
                                                type="button"
                                                onClick={() => {
                                                    if (ativo) {
                                                        setCrosscheckCategoryFilter(crosscheckCategoryFilter.filter(c => c !== b.categoria))
                                                    } else {
                                                        setCrosscheckCategoryFilter([...crosscheckCategoryFilter, b.categoria])
                                                    }
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-xs border transition ${ativo ? meta.cor + ' ring-2 ring-offset-1 ring-purple-400' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                            >
                                                <span className="mr-1">{meta.icon}</span>
                                                {b.label} <span className="font-bold ml-1">({b.qtd})</span>
                                            </button>
                                        )
                                    })}
                                    {crosscheckKPIs.breakdownCategoria.length === 0 && (
                                        <p className="text-sm text-gray-500">Nenhuma oportunidade detectada com os filtros atuais. 🎉</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabela de oportunidades */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-purple-600" />
                                Oportunidades — {crosscheckFiltrado.length} de {analiseCrosscheck.length}
                            </CardTitle>
                            <CardDescription>
                                Lista priorizada por <strong>score</strong> (peso da categoria × dias parado × valor). Cada linha é uma oportunidade — um mesmo lead pode aparecer em múltiplas categorias.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {crosscheckFiltrado.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    <AlertCircle className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                    <p>Nenhuma oportunidade encontrada com esses filtros.</p>
                                </div>
                            ) : (
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-16 text-center">Score</TableHead>
                                                <TableHead className="w-24">Urgência</TableHead>
                                                <TableHead>Categoria</TableHead>
                                                <TableHead>Paciente</TableHead>
                                                <TableHead>Telefone</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-center">Dias parado</TableHead>
                                                <TableHead className="text-right">Valor R$</TableHead>
                                                <TableHead>Ação sugerida</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {crosscheckFiltrado.slice(0, 200).map(o => (
                                                <TableRow key={o.opId} className={o.urgencia === 'critica' ? 'bg-red-50' : ''}>
                                                    <TableCell className="text-center">
                                                        <Badge className="bg-purple-600 text-white font-bold">{o.score}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={URGENCIA_COLORS[o.urgencia] || 'bg-gray-200 text-gray-700'}>
                                                            {o.urgencia}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={CROSSCHECK_CATEGORIAS[o.categoria]?.cor || 'bg-gray-100'}>
                                                            <span className="mr-1">{o.icone}</span>
                                                            {o.categoriaLabel}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-medium">{o.nome}</TableCell>
                                                    <TableCell>{o.telefone || '—'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs">{o.status}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <span className={o.diasParado > 30 ? 'text-red-600 font-bold' : 'text-gray-700'}>
                                                            {o.diasParado}d
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-emerald-700">
                                                        {formatCurrency(o.valorOportunidade)}
                                                    </TableCell>
                                                    <TableCell className="max-w-md text-xs text-gray-700">
                                                        {o.acao}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {crosscheckFiltrado.length > 200 && (
                                        <div className="p-3 text-center text-sm text-gray-500 border-t bg-gray-50">
                                            Exibindo 200 de {crosscheckFiltrado.length} oportunidades — refine os filtros ou exporte XLSX para a lista completa.
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modal de Detalhes */}
            <Dialog open={showLeadDetails} onOpenChange={setShowLeadDetails}>
                <DialogContent className="!max-w-[80vw] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-purple-600" />
                            {selectedCategory?.name} - {categoryLeads.length} pacientes
                        </DialogTitle>
                    </DialogHeader>
                    <div className="rounded-md border mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Paciente</TableHead>
                                    <TableHead>Telefone</TableHead>
                                    <TableHead>Email</TableHead>
                                    {selectedCategory?.type === 'inativos' && (
                                        <TableHead className="text-center">Dias s/ Visita</TableHead>
                                    )}
                                    <TableHead className="text-center">Visitas</TableHead>
                                    <TableHead>Primeira Visita</TableHead>
                                    <TableHead>Última Visita</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categoryLeads.slice(0, 50).map((lead) => (
                                    <TableRow key={lead.id} className={
                                        selectedCategory?.type === 'inativos' && lead.diasSemVisita > 90
                                            ? 'bg-red-50'
                                            : ''
                                    }>
                                        <TableCell className="font-medium">{lead.nome_paciente}</TableCell>
                                        <TableCell>{lead.telefone}</TableCell>
                                        <TableCell>{lead.email || 'N/A'}</TableCell>
                                        {selectedCategory?.type === 'inativos' && (
                                            <TableCell className="text-center">
                                                <Badge className={
                                                    lead.diasSemVisita > 180 ? 'bg-red-600 text-white' :
                                                        lead.diasSemVisita > 90 ? 'bg-red-500 text-white' :
                                                            lead.diasSemVisita > 60 ? 'bg-orange-500 text-white' :
                                                                'bg-yellow-500 text-white'
                                                }>
                                                    {lead.diasSemVisita} dias
                                                </Badge>
                                            </TableCell>
                                        )}
                                        <TableCell className="text-center">
                                            <Badge variant="outline">{lead.total_visitas || 1}</Badge>
                                        </TableCell>
                                        <TableCell>{formatDate(lead.primeira_visita || lead.data_registro_contato)}</TableCell>
                                        <TableCell>{formatDate(lead.ultima_visita)}</TableCell>
                                        <TableCell>
                                            <Badge className={
                                                lead.status === 'Convertido' ? 'bg-green-100 text-green-800' :
                                                    lead.status === 'Agendado' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-gray-100 text-gray-800'
                                            }>
                                                {lead.status || 'Lead'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold text-green-600">
                                            {formatCurrency(lead.valor_total_visitas || lead.valor_orcado)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {categoryLeads.length > 50 && (
                            <div className="p-3 text-center text-sm text-gray-500 border-t">
                                Exibindo 50 de {categoryLeads.length} registros
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
