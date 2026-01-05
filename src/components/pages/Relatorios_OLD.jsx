import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Legend
} from 'recharts'
import { 
  Users, 
  UserPlus, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Target, 
  Loader2,
  X,
  Eye,
  Phone,
  Mail,
  User,
  ArrowLeft,
  Search,
  CalendarDays,
  Download,
  UserCheck,
  RefreshCcw,
  Filter,
  Tag,
  Printer,
  Stethoscope
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import html2canvas from 'html2canvas'
import firebaseDataService from '@/services/firebaseDataService'

const Relatorios = () => {
  const printRef = useRef(null)
  
  const [leads, setLeads] = useState([])
  const [medicos, setMedicos] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Estados para filtro por médico
  const [selectedMedicoFilter, setSelectedMedicoFilter] = useState('all')
  
  // Estados para o modal de leads por médico
  const [selectedMedico, setSelectedMedico] = useState(null)
  const [selectedMedicoLeads, setSelectedMedicoLeads] = useState([])
  const [filteredMedicoLeads, setFilteredMedicoLeads] = useState([])
  const [showMedicoLeads, setShowMedicoLeads] = useState(false)
  const [loadingMedicoLeads, setLoadingMedicoLeads] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estados para filtro por período
  const [showPeriodFilter, setShowPeriodFilter] = useState(false)
  const [periodFilter, setPeriodFilter] = useState({
    startDate: '',
    endDate: '',
    quickFilter: ''
  })
  const [filteredByPeriodLeads, setFilteredByPeriodLeads] = useState([])
  
  // Estados para filtro por tags
  const [showTagFilter, setShowTagFilter] = useState(false)
  const [selectedTagsFilter, setSelectedTagsFilter] = useState([])
  
  // Estados para modal de leads por tag
  const [selectedTag, setSelectedTag] = useState(null)
  const [selectedTagLeads, setSelectedTagLeads] = useState([])
  const [filteredTagLeads, setFilteredTagLeads] = useState([])
  const [showTagLeads, setShowTagLeads] = useState(false)
  const [loadingTagLeads, setLoadingTagLeads] = useState(false)
  const [searchTermTag, setSearchTermTag] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  // Aplicar filtro rápido de período
  useEffect(() => {
    if (periodFilter.quickFilter) {
      const today = new Date()
      let startDate = new Date()
      let endDate = new Date()
      
      switch (periodFilter.quickFilter) {
        case 'hoje':
          startDate = new Date(today.setHours(0, 0, 0, 0))
          endDate = new Date(today.setHours(23, 59, 59, 999))
          break
        case 'ontem':
          startDate = new Date(today.setDate(today.getDate() - 1))
          startDate.setHours(0, 0, 0, 0)
          endDate = new Date(startDate)
          endDate.setHours(23, 59, 59, 999)
          break
        case 'semana':
          startDate = new Date(today.setDate(today.getDate() - 7))
          endDate = new Date()
          break
        case 'mes':
          startDate = new Date(today.setMonth(today.getMonth() - 1))
          endDate = new Date()
          break
        case 'trimestre':
          startDate = new Date(today.setMonth(today.getMonth() - 3))
          endDate = new Date()
          break
        case 'ano':
          startDate = new Date(today.setFullYear(today.getFullYear() - 1))
          endDate = new Date()
          break
        default:
          return
      }
      
      setPeriodFilter(prev => ({
        ...prev,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }))
    }
  }, [periodFilter.quickFilter])

  // Filtrar leads por período quando as datas mudam
  useEffect(() => {
    if (periodFilter.startDate && periodFilter.endDate) {
      filterLeadsByPeriod()
    } else {
      setFilteredByPeriodLeads(leads)
    }
  }, [periodFilter.startDate, periodFilter.endDate, leads])

  // Aplicar filtros combinados (período + tags + médico)
  const getFilteredLeads = () => {
    let filtered = leads

    // Filtro por período
    if (showPeriodFilter && periodFilter.startDate && periodFilter.endDate) {
      filtered = filteredByPeriodLeads
    }

    // Filtro por tags
    if (showTagFilter && selectedTagsFilter.length > 0) {
      filtered = filtered.filter(lead => 
        lead.tags && selectedTagsFilter.some(tagId => lead.tags.includes(tagId))
      )
    }

    // ✅ NOVO: Filtro por médico
    if (selectedMedicoFilter && selectedMedicoFilter !== 'all') {
      filtered = filtered.filter(lead => lead.medico_agendado_id === selectedMedicoFilter)
    }

    return filtered
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [leadsData, medicosData, especialidadesData, tagsData] = await Promise.all([
        firebaseDataService.getAll('leads'),
        firebaseDataService.getAll('medicos'),
        firebaseDataService.getAll('especialidades'),
        firebaseDataService.getAll('tags')
      ])
      
      setLeads(leadsData)
      setFilteredByPeriodLeads(leadsData)
      setMedicos(medicosData)
      setEspecialidades(especialidadesData)
      setTags(tagsData)
    } catch (err) {
      console.error('Erro ao carregar dados dos relatórios:', err)
      setError('Erro ao carregar dados dos relatórios. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Função para filtrar leads por período
  const filterLeadsByPeriod = () => {
    if (!periodFilter.startDate || !periodFilter.endDate) {
      setFilteredByPeriodLeads(leads)
      return
    }
    
    const start = new Date(periodFilter.startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(periodFilter.endDate)
    end.setHours(23, 59, 59, 999)
    
    const filtered = leads.filter(lead => {
      const leadDate = new Date(lead.data_registro_contato)
      return leadDate >= start && leadDate <= end
    })
    
    setFilteredByPeriodLeads(filtered)
  }

  // Limpar filtro de período
  const clearPeriodFilter = () => {
    setPeriodFilter({
      startDate: '',
      endDate: '',
      quickFilter: ''
    })
    setFilteredByPeriodLeads(leads)
  }

  // Função para alternar seleção de tag no filtro
  const toggleTagFilter = (tagId) => {
    if (selectedTagsFilter.includes(tagId)) {
      setSelectedTagsFilter(selectedTagsFilter.filter(id => id !== tagId))
    } else {
      setSelectedTagsFilter([...selectedTagsFilter, tagId])
    }
  }

  // Limpar filtro de tags
  const clearTagFilter = () => {
    setSelectedTagsFilter([])
  }

  // ✅ NOVO: Limpar filtro de médico
  const clearMedicoFilter = () => {
    setSelectedMedicoFilter('all')
  }

  // ✅ NOVO: Limpar todos os filtros
  const clearAllFilters = () => {
    setSelectedMedicoFilter('all')
    setSelectedTagsFilter([])
    clearPeriodFilter()
  }

  // ✅ MELHORADO: Função de impressão completa do relatório com gráficos
  const handlePrint = async () => {
    try {
      // Mostrar indicador de carregamento
      const loadingDiv = document.createElement('div')
      loadingDiv.id = 'print-loading'
      loadingDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-size: 20px;
        font-family: Arial, sans-serif;
      `
      loadingDiv.innerHTML = '<div><div style="text-align:center;"><div style="border: 8px solid #f3f3f3; border-top: 8px solid #3b82f6; border-radius: 50%; width: 60px; height: 60px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div><p>Gerando relatório...</p></div></div><style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>'
      document.body.appendChild(loadingDiv)

      const filteredLeadsData = getFilteredLeads()
      const stats = {
        total: filteredLeadsData.length,
        agendados: filteredLeadsData.filter(l => l.agendado).length,
        convertidos: filteredLeadsData.filter(l => l.status === 'Convertido').length,
        valorTotal: filteredLeadsData.reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0),
        valorConvertido: filteredLeadsData
          .filter(l => l.status === 'Convertido')
          .reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0)
      }

      // Capturar todos os gráficos como imagens
      const charts = document.querySelectorAll('.recharts-wrapper')
      const chartImages = []
      
      for (let i = 0; i < charts.length; i++) {
        try {
          const canvas = await html2canvas(charts[i], {
            scale: 2,
            logging: false,
            useCORS: true,
            backgroundColor: '#ffffff'
          })
          chartImages.push(canvas.toDataURL('image/png'))
        } catch (err) {
          console.error('Erro ao capturar gráfico:', err)
          chartImages.push('')
        }
      }

      // Capturar os cards de métricas principais
      const metricsCards = document.querySelectorAll('.grid.grid-cols-2.md\\:grid-cols-3.lg\\:grid-cols-6 > div')
      const metricsImages = []
      
      for (let i = 0; i < metricsCards.length; i++) {
        try {
          const canvas = await html2canvas(metricsCards[i], {
            scale: 2,
            logging: false,
            useCORS: true,
            backgroundColor: '#ffffff'
          })
          metricsImages.push(canvas.toDataURL('image/png'))
        } catch (err) {
          console.error('Erro ao capturar card de métrica:', err)
          metricsImages.push('')
        }
      }

      // Criar janela de impressão
      const printWindow = window.open('', '', 'width=1200,height=800')
      if (!printWindow) {
        document.body.removeChild(loadingDiv)
        alert('Por favor, permita pop-ups para imprimir o relatório.')
        return
      }

      // Obter informações dos filtros aplicados
      let filtrosAplicados = []
      if (showPeriodFilter && periodFilter.startDate && periodFilter.endDate) {
        filtrosAplicados.push(`Período: ${new Date(periodFilter.startDate).toLocaleDateString('pt-BR')} até ${new Date(periodFilter.endDate).toLocaleDateString('pt-BR')}`)
      }
      if (selectedMedicoFilter && selectedMedicoFilter !== 'all') {
        const medico = medicos.find(m => m.id === selectedMedicoFilter)
        if (medico) {
          filtrosAplicados.push(`Médico: ${medico.nome}`)
        }
      }
      if (showTagFilter && selectedTagsFilter.length > 0) {
        const tagNames = selectedTagsFilter.map(tagId => {
          const tag = tags.find(t => t.id === tagId)
          return tag ? tag.nome : ''
        }).filter(Boolean).join(', ')
        filtrosAplicados.push(`Tags: ${tagNames}`)
      }

      // Montar HTML do relatório
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Relatório de Performance - ${new Date().toLocaleDateString('pt-BR')}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                padding: 40px;
                color: #333;
                background: white;
              }
              .header {
                text-align: center;
                margin-bottom: 40px;
                border-bottom: 4px solid #3b82f6;
                padding-bottom: 25px;
              }
              .header h1 {
                color: #3b82f6;
                font-size: 36px;
                margin-bottom: 10px;
                font-weight: 700;
              }
              .header .subtitle {
                color: #666;
                font-size: 16px;
                margin-top: 10px;
              }
              .header .date {
                color: #888;
                font-size: 14px;
                margin-top: 5px;
              }
              .filters-applied {
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                border: 2px solid #3b82f6;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 35px;
              }
              .filters-applied h3 {
                color: #1e40af;
                margin-bottom: 12px;
                font-size: 18px;
                font-weight: 600;
              }
              .filters-applied p {
                margin: 8px 0;
                font-size: 15px;
                color: #1e3a8a;
                padding-left: 10px;
              }
              .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 25px;
                margin-bottom: 45px;
                page-break-inside: avoid;
              }
              .stat-card {
                border: 2px solid #e5e7eb;
                border-radius: 12px;
                padding: 25px;
                background: white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
              }
              .stat-card.primary {
                border-color: #3b82f6;
                background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
              }
              .stat-card.success {
                border-color: #10b981;
                background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
              }
              .stat-card.warning {
                border-color: #f59e0b;
                background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
              }
              .stat-card h3 {
                font-size: 14px;
                color: #666;
                margin-bottom: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 600;
              }
              .stat-card .value {
                font-size: 32px;
                font-weight: 700;
                color: #1f2937;
                margin-bottom: 8px;
              }
              .stat-card .subtitle {
                font-size: 13px;
                color: #6b7280;
              }
              .section {
                margin-bottom: 45px;
                page-break-inside: avoid;
              }
              .section h2 {
                font-size: 24px;
                color: #1f2937;
                margin-bottom: 20px;
                padding-bottom: 12px;
                border-bottom: 3px solid #e5e7eb;
                font-weight: 600;
              }
              .metrics-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin-bottom: 30px;
              }
              .metric-image {
                width: 100%;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              }
              .chart-container {
                margin-bottom: 35px;
                page-break-inside: avoid;
              }
              .chart-container h3 {
                font-size: 18px;
                color: #374151;
                margin-bottom: 15px;
                font-weight: 600;
              }
              .chart-image {
                width: 100%;
                max-width: 100%;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .ranking-list {
                list-style: none;
                padding: 0;
              }
              .ranking-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 18px;
                margin-bottom: 12px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                background: #f9fafb;
              }
              .ranking-number {
                width: 40px;
                height: 40px;
                background: #3b82f6;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 18px;
                margin-right: 18px;
              }
              .ranking-info {
                flex: 1;
              }
              .ranking-name {
                font-weight: 600;
                font-size: 16px;
                color: #1f2937;
                margin-bottom: 4px;
              }
              .ranking-details {
                font-size: 13px;
                color: #6b7280;
              }
              .ranking-stats {
                text-align: right;
              }
              .ranking-value {
                font-size: 22px;
                font-weight: 700;
                color: #3b82f6;
              }
              .ranking-label {
                font-size: 12px;
                color: #6b7280;
                margin-top: 2px;
              }
              .footer {
                margin-top: 60px;
                padding-top: 25px;
                border-top: 3px solid #e5e7eb;
                text-align: center;
                color: #6b7280;
                font-size: 13px;
              }
              .footer p {
                margin: 5px 0;
              }
              @media print {
                body {
                  padding: 20px;
                }
                .section {
                  page-break-inside: avoid;
                }
                .stat-card {
                  page-break-inside: avoid;
                }
                .chart-container {
                  page-break-inside: avoid;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📊 Relatório de Performance</h1>
              <div class="subtitle">Sistema YouNV - Gestão de Leads e Pacientes</div>
              <div class="date">Gerado em: ${new Date().toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</div>
            </div>

            ${filtrosAplicados.length > 0 ? `
              <div class="filters-applied">
                <h3>🔍 Filtros Aplicados</h3>
                ${filtrosAplicados.map(filtro => `<p>• ${filtro}</p>`).join('')}
              </div>
            ` : ''}

            <div class="stats-grid">
              <div class="stat-card primary">
                <h3>Total de Leads</h3>
                <div class="value">${stats.total}</div>
                <div class="subtitle">Leads no período</div>
              </div>
              
              <div class="stat-card success">
                <h3>Taxa de Conversão</h3>
                <div class="value">${stats.total > 0 ? ((stats.convertidos / stats.total) * 100).toFixed(1) : 0}%</div>
                <div class="subtitle">${stats.convertidos} leads convertidos</div>
              </div>
              
              <div class="stat-card warning">
                <h3>Valor Total</h3>
                <div class="value">${formatCurrency(stats.valorTotal)}</div>
                <div class="subtitle">Convertido: ${formatCurrency(stats.valorConvertido)}</div>
              </div>
              
              <div class="stat-card">
                <h3>Agendamentos</h3>
                <div class="value">${stats.agendados}</div>
                <div class="subtitle">${stats.total > 0 ? ((stats.agendados / stats.total) * 100).toFixed(1) : 0}% do total</div>
              </div>
              
              <div class="stat-card">
                <h3>Valor Médio</h3>
                <div class="value">${stats.total > 0 ? formatCurrency(stats.valorTotal / stats.total) : formatCurrency(0)}</div>
                <div class="subtitle">Por lead</div>
              </div>
              
              <div class="stat-card">
                <h3>Ticket Médio</h3>
                <div class="value">${stats.convertidos > 0 ? formatCurrency(stats.valorConvertido / stats.convertidos) : formatCurrency(0)}</div>
                <div class="subtitle">Por conversão</div>
              </div>
            </div>

            ${metricsImages.length > 0 ? `
              <div class="section">
                <h2>📈 Métricas Detalhadas</h2>
                <div class="metrics-grid">
                  ${metricsImages.map(img => img ? `<img src="${img}" class="metric-image" alt="Métrica" />` : '').join('')}
                </div>
              </div>
            ` : ''}

            ${chartImages.length > 0 ? `
              <div class="section">
                <h2>📊 Gráficos e Análises</h2>
                ${chartImages.map((img, index) => {
                  if (!img) return ''
                  const titles = [
                    'Leads por Canal de Contato',
                    'Distribuição por Status',
                    'Performance dos Médicos',
                    'Evolução de Leads (Últimos 6 Meses)',
                    'Comparação: Novos vs Recorrentes',
                    'Distribuição de Pacientes',
                    'Leads por Tag',
                    'Conversão por Tag',
                    'Valor por Tag'
                  ]
                  return `
                    <div class="chart-container">
                      <h3>${titles[index] || 'Gráfico ' + (index + 1)}</h3>
                      <img src="${img}" class="chart-image" alt="${titles[index] || 'Gráfico'}" />
                    </div>
                  `
                }).join('')}
              </div>
            ` : ''}

            <div class="section">
              <h2>🏆 Ranking de Médicos por Atendimentos</h2>
              <ul class="ranking-list">
                ${medicosPorAtendimento().slice(0, 10).map((medico, index) => `
                  <li class="ranking-item">
                    <div style="display: flex; align-items: center;">
                      <div class="ranking-number">${index + 1}</div>
                      <div class="ranking-info">
                        <div class="ranking-name">${medico.nome}</div>
                        <div class="ranking-details">${medico.total} leads • ${medico.convertidos} convertidos</div>
                      </div>
                    </div>
                    <div class="ranking-stats">
                      <div class="ranking-value">${medico.total > 0 ? ((medico.convertidos / medico.total) * 100).toFixed(1) : 0}%</div>
                      <div class="ranking-label">Taxa de conversão</div>
                    </div>
                  </li>
                `).join('')}
              </ul>
            </div>

            ${tags.length > 0 && leadsPorTag().length > 0 ? `
              <div class="section">
                <h2>🏷️ Ranking de Tags por Desempenho</h2>
                <ul class="ranking-list">
                  ${leadsPorTag().slice(0, 10).map((tagData, index) => `
                    <li class="ranking-item">
                      <div style="display: flex; align-items: center;">
                        <div class="ranking-number">${index + 1}</div>
                        <div class="ranking-info">
                          <div class="ranking-name">${tagData.nome}</div>
                          <div class="ranking-details">${tagData.quantidade} leads</div>
                        </div>
                      </div>
                      <div class="ranking-stats">
                        <div class="ranking-value">${tagData.quantidade}</div>
                        <div class="ranking-label">Total de leads</div>
                      </div>
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}

            <div class="section">
              <h2>👥 Análise por Tipo de Paciente</h2>
              <div class="stats-grid">
                <div class="stat-card primary">
                  <h3>Pacientes Novos</h3>
                  <div class="value">${patientAnalysis.novos.total}</div>
                  <div class="subtitle">${patientAnalysis.novos.taxaConversao}% de conversão</div>
                </div>
                <div class="stat-card success">
                  <h3>Pacientes Recorrentes</h3>
                  <div class="value">${patientAnalysis.recorrentes.total}</div>
                  <div class="subtitle">${patientAnalysis.recorrentes.taxaConversao}% de conversão</div>
                </div>
                <div class="stat-card warning">
                  <h3>Valor Total</h3>
                  <div class="value">${formatCurrency(patientAnalysis.novos.valorTotal + patientAnalysis.recorrentes.valorTotal)}</div>
                  <div class="subtitle">Novos + Recorrentes</div>
                </div>
              </div>
            </div>

            <div class="footer">
              <p><strong>Este relatório foi gerado automaticamente pelo Sistema YouNV</strong></p>
              <p>© ${new Date().getFullYear()} YouNV - Gestão de Leads e Pacientes</p>
              <p style="margin-top: 10px; font-size: 11px; color: #9ca3af;">
                Documento confidencial - Uso interno apenas
              </p>
            </div>
          </body>
        </html>
      `)

      printWindow.document.close()
      
      // Remover indicador de carregamento
      document.body.removeChild(loadingDiv)
      
      // Aguardar um momento para garantir que as imagens foram carregadas
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
      }, 500)
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error)
      alert('Erro ao gerar relatório. Por favor, tente novamente.')
      const loadingDiv = document.getElementById('print-loading')
      if (loadingDiv) {
        document.body.removeChild(loadingDiv)
      }
    }
  }

  // Obter tag por ID
  const getTagById = (tagId) => tags.find(tag => tag.id === tagId)

  // Dados para gráfico de leads por tag
  const leadsPorTag = () => {
    const tagCounts = {}
    
    tags.forEach(tag => {
      const leadsComTag = getFilteredLeads().filter(lead => 
        lead.tags && lead.tags.includes(tag.id)
      )
      if (leadsComTag.length > 0) {
        tagCounts[tag.nome] = {
          nome: tag.nome,
          quantidade: leadsComTag.length,
          cor: tag.cor,
          tag: tag
        }
      }
    })
    
    return Object.values(tagCounts).sort((a, b) => b.quantidade - a.quantidade)
  }

  // Dados para gráfico de conversão por tag
  const conversaoPorTag = () => {
    return tags.map(tag => {
      const leadsComTag = getFilteredLeads().filter(lead => 
        lead.tags && lead.tags.includes(tag.id)
      )
      const convertidos = leadsComTag.filter(lead => lead.status === 'Convertido')
      
      return {
        nome: tag.nome,
        total: leadsComTag.length,
        convertidos: convertidos.length,
        taxa: leadsComTag.length > 0 ? ((convertidos.length / leadsComTag.length) * 100).toFixed(1) : 0,
        cor: tag.cor
      }
    }).filter(item => item.total > 0).sort((a, b) => b.total - a.total)
  }

  // Dados para gráfico de valor por tag
  const valorPorTag = () => {
    return tags.map(tag => {
      const leadsComTag = getFilteredLeads().filter(lead => 
        lead.tags && lead.tags.includes(tag.id)
      )
      const valorTotal = leadsComTag.reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0)
      const valorConvertido = leadsComTag
        .filter(lead => lead.status === 'Convertido')
        .reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0)
      
      return {
        nome: tag.nome,
        'Valor Total': valorTotal,
        'Valor Convertido': valorConvertido,
        cor: tag.cor
      }
    }).filter(item => item['Valor Total'] > 0).sort((a, b) => b['Valor Total'] - a['Valor Total'])
  }

  // Função para carregar leads de uma tag específica
  const loadTagLeads = async (tag) => {
    try {
      setLoadingTagLeads(true)
      setSelectedTag(tag)
      setSearchTermTag('')
      
      const tagLeads = getFilteredLeads().filter(lead => 
        lead.tags && lead.tags.includes(tag.id)
      )
      
      const sortedLeads = tagLeads.sort((a, b) => {
        const dateA = new Date(a.data_registro_contato || 0)
        const dateB = new Date(b.data_registro_contato || 0)
        return dateB - dateA
      })
      
      setSelectedTagLeads(sortedLeads)
      setFilteredTagLeads(sortedLeads)
      setShowTagLeads(true)
    } catch (err) {
      console.error('Erro ao carregar leads da tag:', err)
      setError('Erro ao carregar leads da tag.')
    } finally {
      setLoadingTagLeads(false)
    }
  }

  // Função para filtrar leads da tag baseado na pesquisa
  const handleSearchTag = (term) => {
    setSearchTermTag(term)
    
    if (!term.trim()) {
      setFilteredTagLeads(selectedTagLeads)
      return
    }
    
    const filtered = selectedTagLeads.filter(lead => {
      const searchLower = term.toLowerCase()
      return (
        lead.nome_paciente?.toLowerCase().includes(searchLower) ||
        lead.telefone?.toLowerCase().includes(searchLower) ||
        lead.email?.toLowerCase().includes(searchLower) ||
        lead.canal_contato?.toLowerCase().includes(searchLower) ||
        lead.status?.toLowerCase().includes(searchLower) ||
        lead.solicitacao_paciente?.toLowerCase().includes(searchLower)
      )
    })
    
    setFilteredTagLeads(filtered)
  }

  // Fechar modal de leads por tag
  const closeTagLeads = () => {
    setShowTagLeads(false)
    setSelectedTag(null)
    setSelectedTagLeads([])
    setFilteredTagLeads([])
    setSearchTermTag('')
  }

  // Análise de pacientes novos vs recorrentes no período
  const analyzePatientTypes = () => {
    const leadsToAnalyze = getFilteredLeads()
    
    const novos = leadsToAnalyze.filter(lead => lead.tipo_visita === 'Primeira Visita')
    const recorrentes = leadsToAnalyze.filter(lead => lead.tipo_visita === 'Recorrente')
    
    const valorNovos = novos.reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0)
    const valorRecorrentes = recorrentes.reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0)
    
    const convertidosNovos = novos.filter(lead => lead.status === 'Convertido')
    const convertidosRecorrentes = recorrentes.filter(lead => lead.status === 'Convertido')
    
    const valorConvertidoNovos = convertidosNovos.reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0)
    const valorConvertidoRecorrentes = convertidosRecorrentes.reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0)
    
    return {
      novos: {
        total: novos.length,
        convertidos: convertidosNovos.length,
        valorTotal: valorNovos,
        valorConvertido: valorConvertidoNovos,
        taxaConversao: novos.length > 0 ? ((convertidosNovos.length / novos.length) * 100).toFixed(1) : 0
      },
      recorrentes: {
        total: recorrentes.length,
        convertidos: convertidosRecorrentes.length,
        valorTotal: valorRecorrentes,
        valorConvertido: valorConvertidoRecorrentes,
        taxaConversao: recorrentes.length > 0 ? ((convertidosRecorrentes.length / recorrentes.length) * 100).toFixed(1) : 0
      }
    }
  }

  // Dados para gráfico de comparação
  const getComparisonData = () => {
    const analysis = analyzePatientTypes()
    return [
      {
        tipo: 'Novos',
        Quantidade: analysis.novos.total,
        Convertidos: analysis.novos.convertidos,
        'Valor Orçado': analysis.novos.valorTotal,
        'Valor Convertido': analysis.novos.valorConvertido
      },
      {
        tipo: 'Recorrentes',
        Quantidade: analysis.recorrentes.total,
        Convertidos: analysis.recorrentes.convertidos,
        'Valor Orçado': analysis.recorrentes.valorTotal,
        'Valor Convertido': analysis.recorrentes.valorConvertido
      }
    ]
  }

  // Dados para gráfico de pizza
  const getPieData = () => {
    const analysis = analyzePatientTypes()
    return [
      { name: 'Pacientes Novos', value: analysis.novos.total, color: '#3B82F6' },
      { name: 'Pacientes Recorrentes', value: analysis.recorrentes.total, color: '#10B981' }
    ]
  }

  // Função para carregar leads específicos de um médico
  const loadMedicoLeads = async (medico) => {
    try {
      setLoadingMedicoLeads(true)
      setSelectedMedico(medico)
      setSearchTerm('')
      
      const medicoLeads = getFilteredLeads().filter(lead => lead.medico_agendado_id === medico.id)
      
      const sortedLeads = medicoLeads.sort((a, b) => {
        const dateA = new Date(a.data_registro_contato || 0)
        const dateB = new Date(b.data_registro_contato || 0)
        return dateB - dateA
      })
      
      setSelectedMedicoLeads(sortedLeads)
      setFilteredMedicoLeads(sortedLeads)
      setShowMedicoLeads(true)
    } catch (err) {
      console.error('Erro ao carregar leads do médico:', err)
      setError('Erro ao carregar leads do médico.')
    } finally {
      setLoadingMedicoLeads(false)
    }
  }

  // Função para filtrar leads baseado na pesquisa
  const handleSearch = (term) => {
    setSearchTerm(term)
    
    if (!term.trim()) {
      setFilteredMedicoLeads(selectedMedicoLeads)
      return
    }
    
    const filtered = selectedMedicoLeads.filter(lead => {
      const searchLower = term.toLowerCase()
      return (
        lead.nome_paciente?.toLowerCase().includes(searchLower) ||
        lead.telefone?.toLowerCase().includes(searchLower) ||
        lead.email?.toLowerCase().includes(searchLower) ||
        lead.canal_contato?.toLowerCase().includes(searchLower) ||
        lead.status?.toLowerCase().includes(searchLower) ||
        lead.solicitacao_paciente?.toLowerCase().includes(searchLower)
      )
    })
    
    setFilteredMedicoLeads(filtered)
  }

  // Fechar modal de leads
  const closeMedicoLeads = () => {
    setShowMedicoLeads(false)
    setSelectedMedico(null)
    setSelectedMedicoLeads([])
    setFilteredMedicoLeads([])
    setSearchTerm('')
  }

  // Cálculos para métricas (agora usando leads filtrados)
  const leadsToAnalyze = getFilteredLeads()
  const totalLeads = leadsToAnalyze.length
  const agendados = leadsToAnalyze.filter(l => l.agendado).length
  const convertidos = leadsToAnalyze.filter(l => l.status === 'Convertido').length
  const taxaConversao = totalLeads > 0 ? ((convertidos / totalLeads) * 100).toFixed(1) : 0
  const valorTotal = leadsToAnalyze.reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0)
  const valorConvertido = leadsToAnalyze
    .filter(l => l.status === 'Convertido')
    .reduce((sum, lead) => sum + (lead.valor_orcado || 0), 0)

  // Dados para gráficos (agora usando leads filtrados)
  const leadsPorCanal = () => {
    const canais = {}
    leadsToAnalyze.forEach(lead => {
      canais[lead.canal_contato] = (canais[lead.canal_contato] || 0) + 1
    })
    return Object.entries(canais).map(([canal, quantidade]) => ({
      canal,
      quantidade
    }))
  }

  const leadsPorStatus = () => {
    const status = {}
    leadsToAnalyze.forEach(lead => {
      status[lead.status] = (status[lead.status] || 0) + 1
    })
    return Object.entries(status).map(([status, quantidade]) => ({
      status,
      quantidade
    }))
  }

  const medicosPorAtendimento = () => {
    const stats = {}
    medicos.forEach(medico => {
      const medicoLeads = leadsToAnalyze.filter(lead => lead.medico_agendado_id === medico.id)
      stats[medico.nome] = {
        nome: medico.nome,
        id: medico.id,
        total: medicoLeads.length,
        convertidos: medicoLeads.filter(lead => lead.status === 'Convertido').length,
        medico: medico
      }
    })
    return Object.values(stats).sort((a, b) => b.total - a.total)
  }

  const leadsPorMes = () => {
    const meses = {}
    leadsToAnalyze.forEach(lead => {
      const data = new Date(lead.data_registro_contato)
      const mesAno = `${data.getMonth() + 1}/${data.getFullYear()}`
      meses[mesAno] = (meses[mesAno] || 0) + 1
    })
    return Object.entries(meses).map(([mes, quantidade]) => ({
      mes,
      quantidade
    })).slice(-6)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Não informado'
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR')
  }

  const getStatusBadgeColor = (status) => {
    const colors = {
      'Lead': 'bg-blue-100 text-blue-800',
      'Agendado': 'bg-yellow-100 text-yellow-800',
      'Convertido': 'bg-green-100 text-green-800',
      'Perdido': 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando relatórios...</span>
      </div>
    )
  }

  const patientAnalysis = analyzePatientTypes()

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-600">Análises e métricas de performance</p>
        </div>
        <div className="flex gap-2">
          {/* ✅ NOVO: Botão de Impressão */}
          <Button
            onClick={handlePrint}
            variant="default"
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Relatório
          </Button>
          
          <Button
            onClick={() => setShowPeriodFilter(!showPeriodFilter)}
            variant={showPeriodFilter ? "default" : "outline"}
          >
            <Filter className="h-4 w-4 mr-2" />
            Período
          </Button>
          <Button
            onClick={() => setShowTagFilter(!showTagFilter)}
            variant={showTagFilter ? "default" : "outline"}
          >
            <Tag className="h-4 w-4 mr-2" />
            Tags
          </Button>
        </div>
      </div>

      {/* ✅ NOVO: Filtro por Médico */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center">
              <Stethoscope className="h-5 w-5 mr-2 text-blue-600" />
              Filtrar por Médico
            </span>
            {selectedMedicoFilter !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMedicoFilter}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select value={selectedMedicoFilter} onValueChange={setSelectedMedicoFilter}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Selecione um médico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="font-medium">Todos os Médicos</span>
                  </SelectItem>
                  {medicos.map((medico) => (
                    <SelectItem key={medico.id} value={medico.id}>
                      {medico.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {(selectedMedicoFilter !== 'all' || selectedTagsFilter.length > 0 || (periodFilter.startDate && periodFilter.endDate)) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="whitespace-nowrap"
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Limpar Todos os Filtros
              </Button>
            )}
          </div>

          {selectedMedicoFilter !== 'all' && (
            <div className="mt-3 bg-white rounded-lg p-3 border border-blue-200">
              <p className="text-sm text-gray-600">
                Exibindo dados de: <strong className="text-blue-600">{medicos.find(m => m.id === selectedMedicoFilter)?.nome}</strong>
              </p>
              <p className="text-sm text-blue-600 font-medium mt-1">
                {getFilteredLeads().length} leads encontrados
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtro por Período */}
      {showPeriodFilter && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center">
                <CalendarDays className="h-5 w-5 mr-2" />
                Filtrar por Período
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearPeriodFilter}
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={periodFilter.quickFilter === 'hoje' ? 'default' : 'outline'}
                onClick={() => setPeriodFilter(prev => ({ ...prev, quickFilter: 'hoje' }))}
              >
                Hoje
              </Button>
              <Button
                size="sm"
                variant={periodFilter.quickFilter === 'ontem' ? 'default' : 'outline'}
                onClick={() => setPeriodFilter(prev => ({ ...prev, quickFilter: 'ontem' }))}
              >
                Ontem
              </Button>
              <Button
                size="sm"
                variant={periodFilter.quickFilter === 'semana' ? 'default' : 'outline'}
                onClick={() => setPeriodFilter(prev => ({ ...prev, quickFilter: 'semana' }))}
              >
                Última Semana
              </Button>
              <Button
                size="sm"
                variant={periodFilter.quickFilter === 'mes' ? 'default' : 'outline'}
                onClick={() => setPeriodFilter(prev => ({ ...prev, quickFilter: 'mes' }))}
              >
                Último Mês
              </Button>
              <Button
                size="sm"
                variant={periodFilter.quickFilter === 'trimestre' ? 'default' : 'outline'}
                onClick={() => setPeriodFilter(prev => ({ ...prev, quickFilter: 'trimestre' }))}
              >
                Último Trimestre
              </Button>
              <Button
                size="sm"
                variant={periodFilter.quickFilter === 'ano' ? 'default' : 'outline'}
                onClick={() => setPeriodFilter(prev => ({ ...prev, quickFilter: 'ano' }))}
              >
                Último Ano
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={periodFilter.startDate}
                  onChange={(e) => setPeriodFilter(prev => ({ 
                    ...prev, 
                    startDate: e.target.value,
                    quickFilter: '' 
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={periodFilter.endDate}
                  onChange={(e) => setPeriodFilter(prev => ({ 
                    ...prev, 
                    endDate: e.target.value,
                    quickFilter: '' 
                  }))}
                />
              </div>
            </div>

            {periodFilter.startDate && periodFilter.endDate && (
              <div className="bg-white rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  Exibindo dados de <strong>{formatDate(periodFilter.startDate)}</strong> até <strong>{formatDate(periodFilter.endDate)}</strong>
                </p>
                <p className="text-sm text-blue-600 font-medium mt-1">
                  {filteredByPeriodLeads.length} leads encontrados no período
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filtro por Tags */}
      {showTagFilter && (
        <Card className="bg-purple-50 border-purple-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center">
                <Tag className="h-5 w-5 mr-2" />
                Filtrar por Tags
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearTagFilter}
                disabled={selectedTagsFilter.length === 0}
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTagFilter(tag.id)}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border-2 transition-all ${
                    selectedTagsFilter.includes(tag.id)
                      ? 'text-white border-transparent'
                      : 'text-gray-700 bg-white border-gray-300 hover:border-gray-400'
                  }`}
                  style={{
                    backgroundColor: selectedTagsFilter.includes(tag.id) ? tag.cor : 'white',
                    borderColor: selectedTagsFilter.includes(tag.id) ? tag.cor : '#d1d5db'
                  }}
                >
                  <Tag className="h-3 w-3" />
                  {tag.nome}
                </button>
              ))}
            </div>

            {selectedTagsFilter.length > 0 && (
              <div className="bg-white rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  Filtrando por <strong>{selectedTagsFilter.length}</strong> tag(s)
                </p>
                <p className="text-sm text-purple-600 font-medium mt-1">
                  {getFilteredLeads().length} leads encontrados
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conteúdo para Impressão (Invisível na tela) */}
      <div ref={printRef} style={{ display: 'none' }}>
        <div className="section">
          <h2>🏆 Ranking de Médicos</h2>
          <ul className="ranking-list">
            {medicosPorAtendimento().slice(0, 10).map((medico, index) => (
              <li key={medico.nome} className="ranking-item">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className="ranking-number">{index + 1}</div>
                  <div className="ranking-info">
                    <div className="ranking-name">{medico.nome}</div>
                    <div className="ranking-details">
                      {medico.total} leads • {medico.convertidos} convertidos
                    </div>
                  </div>
                </div>
                <div className="ranking-stats">
                  <div className="ranking-value">
                    {medico.total > 0 ? ((medico.convertidos / medico.total) * 100).toFixed(1) : 0}%
                  </div>
                  <div className="ranking-label">Taxa de conversão</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {tags.length > 0 && leadsPorTag().length > 0 && (
          <div className="section">
            <h2>🏷️ Ranking de Tags</h2>
            <ul className="ranking-list">
              {leadsPorTag().slice(0, 10).map((tagData, index) => (
                <li key={tagData.nome} className="ranking-item">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="ranking-number">{index + 1}</div>
                    <div className="ranking-info">
                      <div className="ranking-name">{tagData.nome}</div>
                      <div className="ranking-details">{tagData.quantidade} leads</div>
                    </div>
                  </div>
                  <div className="ranking-stats">
                    <div className="ranking-value">{tagData.quantidade}</div>
                    <div className="ranking-label">Total de leads</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="section">
          <h2>📊 Análise por Tipo de Paciente</h2>
          <div className="chart-placeholder">
            <p><strong>Pacientes Novos:</strong> {patientAnalysis.novos.total} leads ({patientAnalysis.novos.taxaConversao}% de conversão)</p>
            <p><strong>Pacientes Recorrentes:</strong> {patientAnalysis.recorrentes.total} leads ({patientAnalysis.recorrentes.taxaConversao}% de conversão)</p>
          </div>
        </div>
      </div>

      {/* Cards de Novos vs Recorrentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <UserPlus className="h-5 w-5 mr-2 text-blue-600" />
                Pacientes Novos
              </span>
              <Badge className="bg-blue-600 text-white">
                {patientAnalysis.novos.total} leads
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total de Leads</p>
                <p className="text-2xl font-bold text-gray-900">{patientAnalysis.novos.total}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Convertidos</p>
                <p className="text-2xl font-bold text-green-600">{patientAnalysis.novos.convertidos}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Taxa de Conversão</span>
                <span className="text-lg font-bold text-blue-600">{patientAnalysis.novos.taxaConversao}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${patientAnalysis.novos.taxaConversao}%` }}
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Valor Total Orçado</span>
                <span className="text-lg font-bold">{formatCurrency(patientAnalysis.novos.valorTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Valor Convertido</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(patientAnalysis.novos.valorConvertido)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200">
          <CardHeader className="bg-green-50">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <UserCheck className="h-5 w-5 mr-2 text-green-600" />
                Pacientes Recorrentes
              </span>
              <Badge className="bg-green-600 text-white">
                {patientAnalysis.recorrentes.total} leads
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total de Leads</p>
                <p className="text-2xl font-bold text-gray-900">{patientAnalysis.recorrentes.total}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Convertidos</p>
                <p className="text-2xl font-bold text-green-600">{patientAnalysis.recorrentes.convertidos}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Taxa de Conversão</span>
                <span className="text-lg font-bold text-green-600">{patientAnalysis.recorrentes.taxaConversao}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${patientAnalysis.recorrentes.taxaConversao}%` }}
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Valor Total Orçado</span>
                <span className="text-lg font-bold">{formatCurrency(patientAnalysis.recorrentes.valorTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Valor Convertido</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(patientAnalysis.recorrentes.valorConvertido)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Novos vs Recorrentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Comparação: Novos vs Recorrentes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getComparisonData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tipo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Quantidade" fill="#3B82F6" />
                <Bar dataKey="Convertidos" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Pacientes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getPieData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getPieData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <UserPlus className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              {(showPeriodFilter || showTagFilter || selectedMedicoFilter !== 'all') ? 'Com filtros aplicados' : 'Todos os leads cadastrados'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendamentos</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agendados}</div>
            <p className="text-xs text-muted-foreground">
              {totalLeads > 0 ? ((agendados / totalLeads) * 100).toFixed(1) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Convertidos</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{convertidos}</div>
            <p className="text-xs text-muted-foreground">
              {taxaConversao}% de conversão
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taxaConversao}%</div>
            <p className="text-xs text-muted-foreground">
              Leads → Convertidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Orçado</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(valorTotal)}</div>
            <p className="text-xs text-muted-foreground">
              Total em orçamentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Convertido</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(valorConvertido)}</div>
            <p className="text-xs text-muted-foreground">
              {valorTotal > 0 ? ((valorConvertido / valorTotal) * 100).toFixed(1) : 0}% do orçado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICOS DE TAGS */}
      {tags.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico: Leads por Tag */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Tag className="h-5 w-5 mr-2 text-purple-600" />
                  Leads por Tag
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leadsPorTag().length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={leadsPorTag()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="quantidade" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    Nenhum dado disponível
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico: Taxa de Conversão por Tag */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                  Taxa de Conversão por Tag
                </CardTitle>
              </CardHeader>
              <CardContent>
                {conversaoPorTag().length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={conversaoPorTag()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === 'taxa') return `${value}%`
                          return value
                        }}
                      />
                      <Legend />
                      <Bar dataKey="total" name="Total" fill="#3b82f6" />
                      <Bar dataKey="convertidos" name="Convertidos" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    Nenhum dado disponível
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Gráfico: Valor por Tag */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                Valor por Tag
              </CardTitle>
            </CardHeader>
            <CardContent>
              {valorPorTag().length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={valorPorTag()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Legend />
                    <Bar dataKey="Valor Total" fill="#3b82f6" />
                    <Bar dataKey="Valor Convertido" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ranking de Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Tag className="h-5 w-5 mr-2 text-purple-600" />
                Ranking de Tags por Desempenho
              </CardTitle>
              <p className="text-sm text-gray-600">Clique na tag para ver a lista de leads</p>
            </CardHeader>
            <CardContent>
              {leadsPorTag().length > 0 ? (
                <div className="space-y-4">
                  {leadsPorTag().slice(0, 10).map((tagData, index) => (
                    <div 
                      key={tagData.nome} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => loadTagLeads(tagData.tag)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-purple-600 font-bold text-sm">{index + 1}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center px-3 py-1 rounded-full text-white text-sm font-medium"
                              style={{ backgroundColor: tagData.cor }}
                            >
                              <Tag className="h-3 w-3 mr-1" />
                              {tagData.nome}
                            </span>
                            <Eye className="h-4 w-4 text-gray-400" />
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {tagData.quantidade} leads
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {tagData.quantidade}
                        </p>
                        <p className="text-sm text-gray-500">Total de leads</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Tag className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">Nenhuma tag com leads.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Gráficos Existentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Leads por Canal de Contato</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsPorCanal().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={leadsPorCanal()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="canal" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="quantidade" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsPorStatus().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={leadsPorStatus()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, quantidade }) => `${status}: ${quantidade}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="quantidade"
                  >
                    {leadsPorStatus().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance dos Médicos</CardTitle>
          </CardHeader>
          <CardContent>
            {medicosPorAtendimento().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={medicosPorAtendimento()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#8884d8" name="Total de Leads" />
                  <Bar dataKey="convertidos" fill="#82ca9d" name="Convertidos" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolução de Leads (Últimos 6 Meses)</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsPorMes().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={leadsPorMes()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="quantidade" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking de Médicos */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Médicos por Atendimentos</CardTitle>
          <p className="text-sm text-gray-600">Clique no nome do médico para ver a lista de leads</p>
        </CardHeader>
        <CardContent>
          {medicosPorAtendimento().length > 0 ? (
            <div className="space-y-4">
              {medicosPorAtendimento().map((medico, index) => (
                <div 
                  key={medico.nome} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => loadMedicoLeads(medico.medico)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-sm">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-blue-600 hover:text-blue-800 flex items-center">
                        {medico.nome}
                        <Eye className="h-4 w-4 ml-2" />
                      </p>
                      <p className="text-sm text-gray-500">
                        {medico.total} leads • {medico.convertidos} convertidos
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      {medico.total > 0 ? ((medico.convertidos / medico.total) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-sm text-gray-500">Taxa de conversão</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Nenhum dado de médicos disponível.</p>
              <p className="text-gray-400 text-sm">Cadastre médicos e leads para ver os relatórios.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Leads por Médico */}
      {showMedicoLeads && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Leads de {selectedMedico?.nome}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {filteredMedicoLeads.length} de {selectedMedicoLeads.length} leads
                    {searchTerm && ` (filtrados por "${searchTerm}")`}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeMedicoLeads}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeMedicoLeads}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Pesquisar por nome, telefone, email, canal ou status..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSearch('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {loadingMedicoLeads ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Carregando leads...</span>
                </div>
              ) : selectedMedicoLeads.length > 0 ? (
                filteredMedicoLeads.length > 0 ? (
                  <div className="space-y-4">
                    {filteredMedicoLeads.map((lead) => (
                      <Card key={lead.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <User className="h-5 w-5 text-gray-400" />
                                <h3 className="font-semibold text-lg text-gray-900">
                                  {lead.nome_paciente}
                                </h3>
                                <Badge className={getStatusBadgeColor(lead.status)}>
                                  {lead.status}
                                </Badge>
                                {lead.tipo_visita && (
                                  <Badge variant={lead.tipo_visita === 'Recorrente' ? 'default' : 'outline'}>
                                    {lead.tipo_visita}
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Tags do Lead */}
                              {lead.tags && lead.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {lead.tags.map(tagId => {
                                    const tag = getTagById(tagId)
                                    return tag ? (
                                      <span
                                        key={tagId}
                                        className="inline-flex items-center px-2 py-1 rounded-full text-white text-xs font-medium"
                                        style={{ backgroundColor: tag.cor }}
                                      >
                                        <Tag className="h-3 w-3 mr-1" />
                                        {tag.nome}
                                      </span>
                                    ) : null
                                  })}
                                </div>
                              )}
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                <div className="space-y-2">
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Phone className="h-4 w-4 mr-2" />
                                    {lead.telefone || 'Não informado'}
                                  </div>
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Mail className="h-4 w-4 mr-2" />
                                    {lead.email || 'Não informado'}
                                  </div>
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    {formatDate(lead.data_registro_contato)}
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="text-sm">
                                    <span className="font-medium text-gray-700">Canal:</span>
                                    <span className="ml-2 text-gray-600">{lead.canal_contato || 'Não informado'}</span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium text-gray-700">Agendado:</span>
                                    <span className="ml-2 text-gray-600">{lead.agendado ? 'Sim' : 'Não'}</span>
                                  </div>
                                  {lead.valor_orcado > 0 && (
                                    <div className="text-sm">
                                      <span className="font-medium text-gray-700">Valor:</span>
                                      <span className="ml-2 text-gray-600">{formatCurrency(lead.valor_orcado)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {lead.solicitacao_paciente && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                                  <p className="text-sm text-gray-700">
                                    <span className="font-medium">Solicitação:</span> {lead.solicitacao_paciente}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">Nenhum lead encontrado para "{searchTerm}"</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearch('')}
                      className="mt-2"
                    >
                      Limpar pesquisa
                    </Button>
                  </div>
                )
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">Nenhum lead encontrado para este médico.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Leads por Tag */}
      {showTagLeads && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-white text-sm font-medium"
                      style={{ backgroundColor: selectedTag?.cor }}
                    >
                      <Tag className="h-4 w-4 mr-1" />
                      {selectedTag?.nome}
                    </span>
                  </div>
                  <p className="text-gray-600">
                    {filteredTagLeads.length} de {selectedTagLeads.length} leads
                    {searchTermTag && ` (filtrados por "${searchTermTag}")`}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeTagLeads}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeTagLeads}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Pesquisar por nome, telefone, email, canal ou status..."
                  value={searchTermTag}
                  onChange={(e) => handleSearchTag(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full"
                />
                {searchTermTag && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSearchTag('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {loadingTagLeads ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Carregando leads...</span>
                </div>
              ) : selectedTagLeads.length > 0 ? (
                filteredTagLeads.length > 0 ? (
                  <div className="space-y-4">
                    {filteredTagLeads.map((lead) => (
                      <Card key={lead.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <User className="h-5 w-5 text-gray-400" />
                                <h3 className="font-semibold text-lg text-gray-900">
                                  {lead.nome_paciente}
                                </h3>
                                <Badge className={getStatusBadgeColor(lead.status)}>
                                  {lead.status}
                                </Badge>
                                {lead.tipo_visita && (
                                  <Badge variant={lead.tipo_visita === 'Recorrente' ? 'default' : 'outline'}>
                                    {lead.tipo_visita}
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Outras Tags do Lead */}
                              {lead.tags && lead.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {lead.tags.map(tagId => {
                                    const tag = getTagById(tagId)
                                    return tag ? (
                                      <span
                                        key={tagId}
                                        className="inline-flex items-center px-2 py-1 rounded-full text-white text-xs font-medium"
                                        style={{ backgroundColor: tag.cor }}
                                      >
                                        <Tag className="h-3 w-3 mr-1" />
                                        {tag.nome}
                                      </span>
                                    ) : null
                                  })}
                                </div>
                              )}
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                <div className="space-y-2">
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Phone className="h-4 w-4 mr-2" />
                                    {lead.telefone || 'Não informado'}
                                  </div>
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Mail className="h-4 w-4 mr-2" />
                                    {lead.email || 'Não informado'}
                                  </div>
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    {formatDate(lead.data_registro_contato)}
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="text-sm">
                                    <span className="font-medium text-gray-700">Canal:</span>
                                    <span className="ml-2 text-gray-600">{lead.canal_contato || 'Não informado'}</span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium text-gray-700">Agendado:</span>
                                    <span className="ml-2 text-gray-600">{lead.agendado ? 'Sim' : 'Não'}</span>
                                  </div>
                                  {lead.valor_orcado > 0 && (
                                    <div className="text-sm">
                                      <span className="font-medium text-gray-700">Valor:</span>
                                      <span className="ml-2 text-gray-600">{formatCurrency(lead.valor_orcado)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {lead.solicitacao_paciente && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                                  <p className="text-sm text-gray-700">
                                    <span className="font-medium">Solicitação:</span> {lead.solicitacao_paciente}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">Nenhum lead encontrado para "{searchTermTag}"</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearchTag('')}
                      className="mt-2"
                    >
                      Limpar pesquisa
                    </Button>
                  </div>
                )
              ) : (
                <div className="text-center py-12">
                  <Tag className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">Nenhum lead encontrado para esta tag.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Relatorios
