// ============================================================
// Constantes centralizadas do CRM Younv-Clarion
// ============================================================

// --- Status do Lead (16 valores) ---
export const LEAD_STATUSES = [
  'Lead',
  'Sem Interação',
  'Em Conversa',
  'Agendado',
  'Confirmado',
  'Desmarcou',
  'Reagendado',
  'Convertido',
  'Convertido Parcial',
  'Não Agendou',
  'Faltou',
  'Perdido',
  'Follow Up 1',
  'Follow Up 2',
  'Follow Up 3',
  'Follow Up 7',
]

// --- Cores por Status (para badges, tabelas, etc.) ---
export const STATUS_COLORS = {
  'Lead': 'bg-blue-100 text-blue-800',
  'Sem Interação': 'bg-emerald-100 text-emerald-800',
  'Em Conversa': 'bg-amber-100 text-amber-800',
  'Agendado': 'bg-yellow-100 text-yellow-800',
  'Confirmado': 'bg-purple-100 text-purple-800',
  'Desmarcou': 'bg-red-100 text-red-800',
  'Reagendado': 'bg-amber-200 text-amber-900',
  'Convertido': 'bg-green-100 text-green-800',
  'Convertido Parcial': 'bg-lime-100 text-lime-800',
  'Não Agendou': 'bg-gray-100 text-gray-800',
  'Faltou': 'bg-orange-100 text-orange-800',
  'Perdido': 'bg-red-100 text-red-800',
  'Follow Up 1': 'bg-indigo-50 text-indigo-700',
  'Follow Up 2': 'bg-indigo-100 text-indigo-800',
  'Follow Up 3': 'bg-indigo-200 text-indigo-900',
  'Follow Up 7': 'bg-violet-100 text-violet-800',
}

// --- Colunas do Kanban (13 colunas do funil) ---
// Exclui: Lead, Convertido Parcial, Perdido (estados terminais/iniciais)
export const FUNIL_COLUMNS = [
  {
    id: 'sem_interacao',
    title: 'Sem Interação',
    status: 'Sem Interação',
    color: 'bg-gray-100 border-gray-300',
    textColor: 'text-gray-800',
    iconName: 'User',
  },
  {
    id: 'em_conversa',
    title: 'Em Conversa',
    status: 'Em Conversa',
    color: 'bg-blue-100 border-blue-300',
    textColor: 'text-blue-800',
    iconName: 'Phone',
  },
  {
    id: 'agendado',
    title: 'Agendado',
    status: 'Agendado',
    color: 'bg-yellow-100 border-yellow-300',
    textColor: 'text-yellow-800',
    iconName: 'Calendar',
  },
  {
    id: 'reagendado',
    title: 'Reagendado',
    status: 'Reagendado',
    color: 'bg-amber-100 border-amber-300',
    textColor: 'text-amber-800',
    iconName: 'CalendarClock',
  },
  {
    id: 'desmarcou',
    title: 'Desmarcou',
    status: 'Desmarcou',
    color: 'bg-red-50 border-red-300',
    textColor: 'text-red-800',
    iconName: 'CalendarX',
  },
  {
    id: 'confirmado',
    title: 'Confirmado',
    status: 'Confirmado',
    color: 'bg-purple-100 border-purple-300',
    textColor: 'text-purple-800',
    iconName: 'UserPlus',
  },
  {
    id: 'faltou',
    title: 'Faltou',
    status: 'Faltou',
    color: 'bg-orange-100 border-orange-300',
    textColor: 'text-orange-800',
    iconName: 'UserX',
  },
  {
    id: 'nao_agendou',
    title: 'Não Agendou',
    status: 'Não Agendou',
    color: 'bg-rose-50 border-rose-300',
    textColor: 'text-rose-800',
    iconName: 'CalendarMinus',
  },
  {
    id: 'follow_up_1',
    title: 'Follow Up 1',
    status: 'Follow Up 1',
    color: 'bg-indigo-50 border-indigo-200',
    textColor: 'text-indigo-700',
    iconName: 'PhoneCall',
  },
  {
    id: 'follow_up_2',
    title: 'Follow Up 2',
    status: 'Follow Up 2',
    color: 'bg-indigo-100 border-indigo-300',
    textColor: 'text-indigo-800',
    iconName: 'PhoneCall',
  },
  {
    id: 'follow_up_3',
    title: 'Follow Up 3',
    status: 'Follow Up 3',
    color: 'bg-indigo-200 border-indigo-400',
    textColor: 'text-indigo-900',
    iconName: 'PhoneCall',
  },
  {
    id: 'follow_up_7',
    title: 'Follow Up 7',
    status: 'Follow Up 7',
    color: 'bg-violet-100 border-violet-300',
    textColor: 'text-violet-800',
    iconName: 'PhoneForwarded',
  },
  {
    id: 'convertido',
    title: 'Convertido',
    status: 'Convertido',
    color: 'bg-green-100 border-green-300',
    textColor: 'text-green-800',
    iconName: 'TrendingUp',
  },
]

// --- Canais de Contato ---
export const CANAIS_CONTATO = [
  'Lead Interno',
  'Instagram',
  'Facebook',
  'WhatsApp',
  'Google',
  'Indicação',
  'Site',
  'Telefone',
  'Email',
  'Outros',
]

// --- Perfis Comportamentais DISC ---
export const DISC_PROFILES = [
  { value: 'D', label: 'D - Dominante' },
  { value: 'I', label: 'I - Influente' },
  { value: 'A', label: 'A - Analítico' },
  { value: 'F', label: 'F - Afável' },
]

// --- Tipos de Visita ---
export const TIPOS_VISITA = [
  'Consulta',
  'Retorno',
  'Procedimento',
  'Exame',
  'Pré-Operatório',
  'Pós-Operatório',
  'Emergência',
  'Outro',
]

// --- Status de Visita ---
export const STATUS_VISITA = [
  'Realizada',
  'Agendada',
  'Cancelada',
  'Faltou',
  'Remarcada',
]

// --- Cores de Status de Visita ---
export const STATUS_VISITA_COLORS = {
  'Realizada': 'bg-green-100 text-green-800',
  'Agendada': 'bg-blue-100 text-blue-800',
  'Cancelada': 'bg-red-100 text-red-800',
  'Faltou': 'bg-orange-100 text-orange-800',
  'Remarcada': 'bg-yellow-100 text-yellow-800',
}

// --- Categorias de Tags ---
export const TAG_CATEGORIES = [
  'Procedimento',
  'Especialidade',
  'Prioridade',
  'Tipo Cliente',
  'Condição',
  'Outros',
]

// --- Helper: obter cor de status de lead ---
export function getStatusColor(status) {
  return STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'
}

// --- Helper: obter cor de status de visita ---
export function getVisitStatusColor(status) {
  return STATUS_VISITA_COLORS[status] || 'bg-gray-100 text-gray-800'
}
