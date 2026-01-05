import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  Activity, 
  ClipboardList, 
  BarChart3,
  DollarSign,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useRealtimeFirestore } from '@/hooks/useFirestore'
import { useMemo, useState, useEffect } from 'react'

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const location = useLocation()
  const { data: leads, loading: leadsLoading } = useRealtimeFirestore('leads')
  
  // Estado de colapso - carregar do localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved === 'true'
  })

  // Salvar preferência no localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed)
  }, [isCollapsed])

  // Função para verificar se uma data é hoje
  const isToday = (dateString) => {
    if (!dateString) return false
    
    try {
      const date = new Date(dateString)
      const today = new Date()
      
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      
      return dateOnly.getTime() === todayOnly.getTime()
    } catch (error) {
      console.error('Erro ao verificar data:', error)
      return false
    }
  }

  // Cálculo de estatísticas
  const stats = useMemo(() => {
    if (leadsLoading || !leads || leads.length === 0) {
      return {
        totalLeads: 0,
        leadsHoje: 0,
        agendamentosHoje: 0,
        receitaHoje: 0
      }
    }

    const leadsHoje = leads.filter(lead => {
      const dataRegistro = lead.data_registro_contato || lead.dataRegistroContato
      return isToday(dataRegistro)
    })

    const agendamentosHoje = leadsHoje.filter(lead => {
      const agendado = lead.agendado === true
      const statusAgendado = ['Agendado', 'agendado', 'AGENDADO', 'Confirmado', 'confirmado'].includes(lead.status)
      return agendado || statusAgendado
    }).length

    const leadsConvertidosHoje = leadsHoje.filter(lead => {
      const statusConvertido = ['Convertido', 'convertido', 'CONVERTIDO'].includes(lead.status)
      const orcamentoFechado = lead.orcamento_fechado === 'Total' || lead.orcamento_fechado === 'Parcial'
      return statusConvertido || orcamentoFechado
    })

    const receitaHoje = leadsConvertidosHoje.reduce((total, lead) => {
      const valorOrcado = lead.valor_orcado || lead.valorOrcado || 0
      const valorFechadoParcial = lead.valor_fechado_parcial || lead.valorFechadoParcial || 0
      const orcamentoStatus = lead.orcamento_fechado || lead.orcamentoFechado

      let valorParaUsar = 0

      if (orcamentoStatus === 'Parcial' && valorFechadoParcial > 0) {
        valorParaUsar = valorFechadoParcial
      } else if (orcamentoStatus === 'Total' || lead.status === 'Convertido') {
        valorParaUsar = valorOrcado
      }

      if (typeof valorParaUsar === 'string') {
        valorParaUsar = parseFloat(valorParaUsar.replace(/[R$\s.,]/g, '').replace(',', '.')) || 0
      }

      return total + valorParaUsar
    }, 0)

    return {
      totalLeads: leads.length,
      leadsHoje: leadsHoje.length,
      agendamentosHoje,
      receitaHoje
    }
  }, [leads, leadsLoading])

  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: LayoutDashboard,
      description: 'Visão geral'
    },
    { 
      name: 'Leads', 
      href: '/leads', 
      icon: UserPlus,
      description: 'Gestão de leads',
      badge: stats.totalLeads
    },
    { 
      name: 'Médicos', 
      href: '/medicos', 
      icon: Users,
      description: 'Profissionais'
    },
    { 
      name: 'Especialidades', 
      href: '/especialidades', 
      icon: Activity,
      description: 'Áreas médicas'
    },
    { 
      name: 'Procedimentos', 
      href: '/procedimentos', 
      icon: ClipboardList,
      description: 'Serviços'
    },
    { 
      name: 'Relatórios', 
      href: '/relatorios', 
      icon: BarChart3,
      description: 'Análises'
    }
  ]

  const formatCurrency = (value) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`
    }
    return value.toLocaleString('pt-BR', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    })
  }

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) {
      onClose()
    }
  }

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <>
      {/* Overlay para mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 bg-gray-900 text-white transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
        isCollapsed ? "lg:w-20" : "lg:w-64",
        "w-64" // Mobile sempre usa largura total
      )}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className={cn(
            "flex flex-col items-center border-b border-gray-800 transition-all duration-300",
            isCollapsed ? "gap-2 p-4" : "gap-3 p-6"
          )}>
            <div className="flex w-full justify-between items-center">
              {!isCollapsed && <div></div>}
              
              {/* Mobile: X para fechar */}
              <button
                onClick={onClose}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              
              {/* Desktop: Botão para colapsar/expandir */}
              <button
                onClick={toggleCollapse}
                className="hidden lg:block p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors ml-auto"
                title={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
              </button>
            </div>
            
            {/* Logo */}
            <div className="flex items-center justify-center">
              <img 
                src="/Younv-Official.png" 
                alt="Younv" 
                className={cn(
                  "transition-all duration-300",
                  isCollapsed ? "h-8 w-auto" : "h-12 w-auto"
                )}
              />
            </div>
            
            {/* Título - só aparece quando expandido */}
            {!isCollapsed && (
              <div className="text-center">
                <h1 className="text-xl font-bold">Clinical CRM</h1>
                <p className="text-sm text-gray-400">v2.0</p>
              </div>
            )}
            
            {/* Título mini - só aparece quando colapsado */}
            {isCollapsed && (
              <div className="text-center">
                <p className="text-xs text-gray-400">v2.0</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className={cn(
            "flex-1 overflow-y-auto",
            isCollapsed ? "p-2 space-y-1" : "p-4 space-y-2"
          )}>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleLinkClick}
                  className={cn(
                    'flex items-center rounded-lg text-sm font-medium transition-colors group relative',
                    isCollapsed ? 'justify-center p-3' : 'justify-between gap-3 px-3 py-3',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                  title={isCollapsed ? item.name : ''}
                >
                  {isCollapsed ? (
                    // Versão colapsada - só ícone
                    <>
                      <div className="relative">
                        <item.icon className="h-6 w-6" />
                        {item.badge && (
                          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </div>
                      
                      {/* Tooltip ao passar o mouse */}
                      <div className="absolute left-full ml-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-gray-400">{item.description}</div>
                        {item.badge && (
                          <div className="text-xs text-blue-400 mt-1">
                            {item.badge} itens
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    // Versão expandida - ícone + texto
                    <>
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        <div>
                          <div>{item.name}</div>
                          <div className="text-xs text-gray-400">{item.description}</div>
                        </div>
                      </div>
                      {item.badge && (
                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Resumo Rápido */}
          <div className={cn(
            "border-t border-gray-800 transition-all duration-300",
            isCollapsed ? "p-2" : "p-4"
          )}>
            {!isCollapsed ? (
              // Versão expandida
              <>
                <h3 className="text-sm font-medium text-gray-400 mb-3">RESUMO DE HOJE</h3>
                
                {leadsLoading ? (
                  <div className="space-y-3">
                    <div className="animate-pulse bg-gray-700 h-4 rounded"></div>
                    <div className="animate-pulse bg-gray-700 h-4 rounded"></div>
                    <div className="animate-pulse bg-gray-700 h-4 rounded"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-blue-400" />
                        <span className="text-sm">Novos Leads</span>
                      </div>
                      <span className="text-lg font-bold text-blue-400">{stats.leadsHoje}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-green-400" />
                        <span className="text-sm">Agendamentos</span>
                      </div>
                      <span className="text-lg font-bold text-green-400">{stats.agendamentosHoje}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm">Receita</span>
                      </div>
                      <span className="text-lg font-bold text-yellow-400">
                        R$ {formatCurrency(stats.receitaHoje)}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 text-center mt-3 pt-2 border-t border-gray-700">
                      {stats.totalLeads > 0 ? (
                        `${stats.totalLeads} leads total`
                      ) : (
                        'Nenhum lead cadastrado'
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Versão colapsada - ícones com tooltips
              <div className="space-y-2">
                <div className="relative group">
                  <div className="flex items-center justify-center p-2 rounded-md hover:bg-gray-800 cursor-pointer">
                    <UserPlus className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    <div className="text-xs text-gray-400">Novos Leads</div>
                    <div className="text-lg font-bold text-blue-400">{stats.leadsHoje}</div>
                  </div>
                </div>
                
                <div className="relative group">
                  <div className="flex items-center justify-center p-2 rounded-md hover:bg-gray-800 cursor-pointer">
                    <Calendar className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    <div className="text-xs text-gray-400">Agendamentos</div>
                    <div className="text-lg font-bold text-green-400">{stats.agendamentosHoje}</div>
                  </div>
                </div>
                
                <div className="relative group">
                  <div className="flex items-center justify-center p-2 rounded-md hover:bg-gray-800 cursor-pointer">
                    <DollarSign className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    <div className="text-xs text-gray-400">Receita Hoje</div>
                    <div className="text-lg font-bold text-yellow-400">
                      R$ {formatCurrency(stats.receitaHoje)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={cn(
            "border-t border-gray-800 transition-all duration-300",
            isCollapsed ? "p-2" : "p-4"
          )}>
            {!isCollapsed ? (
              <div className="text-center">
                <p className="text-sm font-medium">Younv Consultoria</p>
                <p className="text-xs text-gray-400">Sistema de Gestão</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xs font-medium">Younv</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
