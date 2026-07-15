import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState, lazy, Suspense } from 'react'
import './App.css'

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext'

// Layout Components
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'

// Login fica no bundle principal (primeira tela)
import Login from './components/pages/Login'

// CODE-SPLITTING POR ROTA: cada página vira um chunk carregado sob demanda.
// Antes o bundle era um único arquivo de ~2.3MB (594KB gzip) com recharts,
// xlsx e html2canvas carregados até na tela de login.
const Dashboard = lazy(() => import('./components/pages/Dashboard'))
const Medicos = lazy(() => import('./components/pages/Medicos'))
const Especialidades = lazy(() => import('./components/pages/Especialidades'))
const Procedimentos = lazy(() => import('./components/pages/Procedimentos'))
const Leads = lazy(() => import('./components/pages/Leads'))
const Lembretes = lazy(() => import('./components/pages/Lembretes'))
const Relatorios = lazy(() => import('./components/pages/Relatorios'))
const RelatorioRecorrentes = lazy(() => import('./components/pages/RelatorioRecorrentes'))
const Estoque = lazy(() => import('./components/pages/estoque/Estoque'))
const GestaoCarteira = lazy(() => import('./components/pages/GestaoCarteira'))
const PosConsulta = lazy(() => import('./components/pages/PosConsulta'))

// Fallback exibido enquanto o chunk da página carrega
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-200 border-t-purple-600"></div>
      <span className="ml-3 text-gray-600">Carregando...</span>
    </div>
  )
}

// Componente principal da aplicação autenticada
function AuthenticatedApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} user={user} />

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/medicos" element={<Medicos />} />
              <Route path="/especialidades" element={<Especialidades />} />
              <Route path="/procedimentos" element={<Procedimentos />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/lembretes" element={<Lembretes />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/relatorio-recorrentes" element={<RelatorioRecorrentes />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/gestao-carteira" element={<GestaoCarteira />} />
              <Route path="/pos-consulta" element={<PosConsulta />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  )
}

// Componente que gerencia autenticação
function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium">Carregando sistema...</p>
        </div>
      </div>
    )
  }

  return user ? <AuthenticatedApp /> : <Login />
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  )
}

export default App
