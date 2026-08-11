import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MinusCircle, AlertCircle, Package, User, Calendar, MapPin, Search, Phone, Mail, X, Stethoscope } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import estoqueDataService from '@/services/estoque/estoqueDataService'
import firebaseDataService from '@/services/firebaseDataService'
import { useAuth } from '@/contexts/AuthContext'

// 🔥 FUNÇÃO DE DEBOUNCE
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

const MOTIVOS_BAIXA = [
  'Uso em Paciente',
  'Uso em Procedimento',
  'Uso por Profissional',
  'Amostra Grátis',
  'Vencimento',
  'Perda/Quebra',
  'Devolução',
  'Teste/Qualidade',
  'Descarte',
  'Transferência',
  'Outro'
]

// Motivos que exigem a seleção de um paciente do CRM
const MOTIVOS_COM_PACIENTE = ['Uso em Paciente', 'Uso em Procedimento']

// Motivos que exigem a atribuição a um profissional (médico cadastrado no CRM).
// Nos demais motivos o profissional continua disponível, porém opcional.
const MOTIVOS_COM_PROFISSIONAL = ['Uso por Profissional']

/**
 * 🆕 VERSÃO V2 - COM INTEGRAÇÃO AO CRM
 *
 * Mudanças principais:
 * - Seleção de pacientes do CRM (ao invés de digitar manualmente)
 * - Registro automático de consumo no histórico do paciente
 * - Cálculo de ticket médio
 * - Visualização de histórico de consumo
 */
export default function BaixaManualEstoqueV2({ produto, estoques: estoquesProp, onSuccess }) {
  const [isOpen, setIsOpen] = useState(false)
  const [lotes, setLotes] = useState([])
  const [estoques, setEstoques] = useState([])
  const [pacientesFiltrados, setPacientesFiltrados] = useState([])
  const [medicos, setMedicos] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingPacientes, setLoadingPacientes] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const { user } = useAuth()
  
  // 🔥 Busca otimizada
  const [searchPaciente, setSearchPaciente] = useState('')
  const [showPacientesList, setShowPacientesList] = useState(false)
  
  const [formData, setFormData] = useState({
    estoque_id: '',
    lote_id: '',
    quantidade: '',
    motivo: '',
    observacao: '',
    paciente_id: '', // 🆕 ID do paciente selecionado
    paciente_nome: '',
    paciente_cpf: '',
    // 🆕 Profissional (médico do CRM) a quem a baixa é debitada
    medico_id: '',
    medico_nome: '',
    medico_crm: '',
    medico_especialidade_id: '',
    valor_unitario: produto.valor_unitario || 0
  })

  // Carregar estoques e profissionais
  useEffect(() => {
    if (isOpen) {
      if (estoquesProp && estoquesProp.length > 0) {
        setEstoques(estoquesProp)
      } else {
        loadEstoques()
      }
      loadMedicos()
    }
  }, [isOpen, estoquesProp])

  // Carregar lotes quando localização for selecionada
  useEffect(() => {
    if (isOpen && formData.estoque_id && estoques.length > 0) {
      loadLotes()
    } else {
      setLotes([])
    }
  }, [isOpen, formData.estoque_id, estoques])

  // 🔥 BUSCA OTIMIZADA DE PACIENTES - SÓ CARREGA QUANDO NECESSÁRIO
  const buscarPacientes = useCallback(async (termo) => {
    if (!termo || termo.length < 2) {
      setPacientesFiltrados([])
      return
    }

    try {
      setLoadingPacientes(true)
      console.log('🔍 Buscando pacientes:', termo)
      
      const leadsData = await firebaseDataService.getAll('leads')

      // Busca em TODOS os leads (o filtro anterior por status Convertido/Agendado/Confirmado
      // escondia a maioria dos pacientes — ex.: leads do WhatsApp com status 'Lead')
      const termoLower = termo.toLowerCase()
      const resultados = leadsData.filter(lead => {
        const matchNome = lead.nome_paciente?.toLowerCase().includes(termoLower)
        const matchTelefone = lead.telefone?.includes(termo)
        const matchEmail = lead.email?.toLowerCase().includes(termoLower)

        return matchNome || matchTelefone || matchEmail
      })
      
      // Limitar a 20 resultados para performance
      setPacientesFiltrados(resultados.slice(0, 20))
      console.log('✅ Pacientes encontrados:', resultados.length)
    } catch (error) {
      console.error('❌ Erro ao buscar pacientes:', error)
      setPacientesFiltrados([])
    } finally {
      setLoadingPacientes(false)
    }
  }, [])

  // 🔥 DEBOUNCE NA BUSCA - Espera 500ms após o usuário parar de digitar
  const debouncedBuscarPacientes = useMemo(
    () => debounce((termo) => buscarPacientes(termo), 500),
    [buscarPacientes]
  )

  // Executar busca quando searchPaciente mudar
  useEffect(() => {
    if (searchPaciente.length >= 2) {
      debouncedBuscarPacientes(searchPaciente)
    } else {
      setPacientesFiltrados([])
    }
  }, [searchPaciente, debouncedBuscarPacientes])

  // Fechar lista de pacientes ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target
      if (!target.closest('.pacientes-search-container')) {
        setShowPacientesList(false)
      }
    }

    if (showPacientesList) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPacientesList])

  const loadMedicos = async () => {
    try {
      const [medicosData, especialidadesData] = await Promise.all([
        estoqueDataService.getMedicos(),
        estoqueDataService.getEspecialidades()
      ])
      setMedicos(medicosData)
      setEspecialidades(especialidadesData)
    } catch (error) {
      console.error('❌ Erro ao carregar profissionais:', error)
      setMedicos([])
      setEspecialidades([])
    }
  }

  const getEspecialidadeNome = (id) => {
    const especialidade = especialidades.find(e => e.id === id)
    return especialidade ? especialidade.nome : ''
  }

  const loadEstoques = async () => {
    try {
      console.log('📍 Carregando estoques...')
      const estoquesData = await estoqueDataService.getEstoques()
      setEstoques(estoquesData)
      console.log('✅ Estoques carregados:', estoquesData.length)
    } catch (error) {
      console.error('❌ Erro ao carregar estoques:', error)
      setError('Erro ao carregar localizações')
      setEstoques([])
    }
  }

  const loadLotes = async () => {
    try {
      setLoading(true)
      console.log('📦 Carregando lotes do produto:', produto.id, 'na localização:', formData.estoque_id)
      
      const todosLotes = await estoqueDataService.getLotes()
      
      const lotesDoProdutoNoLocal = todosLotes.filter(lote => 
        lote.produto_id === produto.id && 
        lote.estoque_id === formData.estoque_id && 
        lote.quantidade_atual > 0
      )
      
      const lotesOrdenados = lotesDoProdutoNoLocal.sort((a, b) => {
        if (!a.data_validade) return 1
        if (!b.data_validade) return -1
        return new Date(a.data_validade) - new Date(b.data_validade)
      })
      
      setLotes(lotesOrdenados)
      console.log('✅ Lotes carregados nesta localização:', lotesOrdenados.length)
    } catch (error) {
      console.error('❌ Erro ao carregar lotes:', error)
      setError('Erro ao carregar lotes disponíveis')
      setLotes([])
    } finally {
      setLoading(false)
    }
  }

  // 🆕 Selecionar paciente
  const handleSelecionarPaciente = useCallback((paciente) => {
    // Se o paciente já tem médico agendado no CRM, sugerir esse profissional —
    // o usuário ainda pode trocar (quem executou pode não ser quem agendou)
    const medicoDoPaciente = paciente.medico_agendado_id
      ? medicos.find(m => m.id === paciente.medico_agendado_id)
      : null

    setFormData(prev => ({
      ...prev,
      paciente_id: paciente.id,
      paciente_nome: paciente.nome_paciente,
      paciente_cpf: '',
      motivo: 'Uso em Paciente', // Definir automaticamente
      ...(medicoDoPaciente && !prev.medico_id
        ? {
            medico_id: medicoDoPaciente.id,
            medico_nome: medicoDoPaciente.nome || '',
            medico_crm: medicoDoPaciente.crm || '',
            medico_especialidade_id: medicoDoPaciente.especialidade_id || medicoDoPaciente.especialidadeId || ''
          }
        : {})
    }))
    setShowPacientesList(false)
    setSearchPaciente(paciente.nome_paciente) // Mostrar nome no input
  }, [medicos])

  // 🆕 Selecionar profissional (médico do CRM)
  const handleSelecionarMedico = useCallback((medicoId) => {
    if (medicoId === 'nenhum') {
      setFormData(prev => ({
        ...prev,
        medico_id: '',
        medico_nome: '',
        medico_crm: '',
        medico_especialidade_id: ''
      }))
      return
    }

    const medico = medicos.find(m => m.id === medicoId)
    if (!medico) return

    setFormData(prev => ({
      ...prev,
      medico_id: medico.id,
      medico_nome: medico.nome || '',
      medico_crm: medico.crm || '',
      medico_especialidade_id: medico.especialidade_id || medico.especialidadeId || ''
    }))
  }, [medicos])

  // 🆕 Registrar consumo no histórico do paciente
  const registrarConsumoNoPaciente = async (pacienteId, dadosConsumo) => {
    try {
      // Buscar paciente atual
      const paciente = await firebaseDataService.getById('leads', pacienteId)
      
      if (!paciente) {
        console.warn('⚠️ Paciente não encontrado:', pacienteId)
        return
      }

      // Criar estrutura de histórico de consumo se não existir
      const historicoConsumo = paciente.historico_consumo || []
      
      const novoConsumo = {
        data: new Date().toISOString(),
        produto_id: dadosConsumo.produto_id,
        produto_nome: dadosConsumo.produto_nome,
        lote_numero: dadosConsumo.lote_numero,
        medico_id: dadosConsumo.medico_id || '',
        medico_nome: dadosConsumo.medico_nome || '',
        quantidade: dadosConsumo.quantidade,
        valor_unitario: dadosConsumo.valor_unitario,
        valor_total: dadosConsumo.quantidade * dadosConsumo.valor_unitario,
        estoque_nome: dadosConsumo.estoque_nome,
        usuario_nome: dadosConsumo.usuario_nome,
        observacao: dadosConsumo.observacao
      }

      historicoConsumo.push(novoConsumo)

      // Calcular estatísticas
      const totalGasto = historicoConsumo.reduce((sum, item) => sum + (item.valor_total || 0), 0)
      const ticketMedio = totalGasto / historicoConsumo.length

      // Usar a função update existente do firebaseDataService
      // Ela já gerencia toda a lógica de transformação e salvamento
      await firebaseDataService.update('leads', pacienteId, {
        ...paciente,
        historico_consumo: historicoConsumo,
        total_gasto_produtos: totalGasto,
        ticket_medio_produtos: ticketMedio,
        ultima_compra_data: new Date().toISOString(),
        total_consumos: historicoConsumo.length
      })

      console.log('✅ Consumo registrado no histórico do paciente')
    } catch (error) {
      console.error('❌ Erro ao registrar consumo no paciente:', error)
      // Não bloquear a baixa se falhar
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setSaving(true)
      setError(null)

      console.log('🚀 Iniciando baixa de estoque...')

      // Validações
      const quantidade = parseInt(formData.quantidade)
      if (!quantidade || quantidade <= 0) {
        throw new Error('Quantidade deve ser maior que zero')
      }

      if (!formData.estoque_id) {
        throw new Error('Selecione uma localização')
      }

      if (!formData.lote_id) {
        throw new Error('Selecione um lote')
      }

      if (!formData.motivo) {
        throw new Error('Selecione o motivo da baixa')
      }

      // 🆕 Validar paciente se motivo for "Uso em Paciente"
      if (MOTIVOS_COM_PACIENTE.includes(formData.motivo) && !formData.paciente_id) {
        throw new Error('Selecione um paciente para registrar o consumo')
      }

      // 🆕 Validar profissional quando o motivo exigir
      if (MOTIVOS_COM_PROFISSIONAL.includes(formData.motivo) && !formData.medico_id) {
        throw new Error('Selecione o profissional para debitar esta baixa')
      }

      const lote = lotes.find(l => l.id === formData.lote_id)
      if (!lote) {
        throw new Error('Lote não encontrado')
      }

      if (quantidade > lote.quantidade_atual) {
        throw new Error(`Quantidade indisponível. Disponível: ${lote.quantidade_atual}`)
      }

      const estoque = estoques.find(e => e.id === formData.estoque_id)
      if (!estoque) {
        throw new Error('Localização não encontrada')
      }

      const userInfo = user ? {
        id: user.uid,
        nome: user.displayName || user.email,
        email: user.email
      } : {
        id: 'sistema',
        nome: 'Sistema',
        email: 'sistema@younv.com'
      }

      console.log('👤 Usuário executando baixa:', userInfo)
      console.log('📍 Localização da baixa:', estoque.nome)

      // 1️⃣ CRIAR MOVIMENTAÇÃO DE SAÍDA
      const movimentacao = {
        produto_id: produto.id,
        lote_id: lote.id,
        tipo: 'saida',
        quantidade: quantidade,
        motivo: formData.motivo,
        observacao: formData.observacao || '',
        paciente_id: formData.paciente_id || '',
        paciente_nome: formData.paciente_nome || '',
        paciente_cpf: formData.paciente_cpf || '',
        // 🆕 Profissional a quem a baixa foi debitada (base do relatório Por Profissional)
        medico_id: formData.medico_id || '',
        medico_nome: formData.medico_nome || '',
        medico_crm: formData.medico_crm || '',
        medico_especialidade_id: formData.medico_especialidade_id || '',
        estoque_id: formData.estoque_id,
        estoque_nome: estoque.nome,
        usuario_id: userInfo.id,
        usuario_nome: userInfo.nome,
        usuario_email: userInfo.email,
        valor_unitario: formData.valor_unitario,
        valor_total: quantidade * formData.valor_unitario,
        data_movimentacao: new Date().toISOString()
      }

      console.log('📝 Criando movimentação:', movimentacao)
      await estoqueDataService.createMovimentacao(movimentacao)

      // 2️⃣ ATUALIZAR LOTE
      const novaQuantidadeLote = lote.quantidade_atual - quantidade
      console.log(`📦 Atualizando lote: ${lote.quantidade_atual} - ${quantidade} = ${novaQuantidadeLote}`)
      
      await estoqueDataService.updateLote(lote.id, {
        quantidade_atual: novaQuantidadeLote
      })

      // 3️⃣ ATUALIZAR ESTOQUE GERAL DO PRODUTO
      console.log('🔄 Recalculando estoque total do produto...')
      
      const todosOsLotes = await estoqueDataService.getLotes()
      const lotesDoProduto = todosOsLotes.filter(l => l.produto_id === produto.id)
      
      const novoEstoqueTotal = lotesDoProduto.reduce((total, l) => {
        if (l.id === lote.id) {
          return total + novaQuantidadeLote
        }
        return total + (l.quantidade_atual || 0)
      }, 0)

      console.log(`📊 Novo estoque total calculado: ${novoEstoqueTotal}`)

      await estoqueDataService.updateProduto(produto.id, {
        estoque_atual: novoEstoqueTotal
      })

      // 4️⃣ 🆕 REGISTRAR CONSUMO NO HISTÓRICO DO PACIENTE
      if (formData.paciente_id) {
        console.log('💾 Registrando consumo no histórico do paciente...')
        await registrarConsumoNoPaciente(formData.paciente_id, {
          produto_id: produto.id,
          produto_nome: produto.nome_comercial,
          lote_numero: lote.numero_lote,
          quantidade: quantidade,
          valor_unitario: formData.valor_unitario,
          estoque_nome: estoque.nome,
          usuario_nome: userInfo.nome,
          medico_id: formData.medico_id,
          medico_nome: formData.medico_nome,
          observacao: formData.observacao
        })
      }

      console.log('✅ Baixa de estoque realizada com sucesso!')

      // Resetar formulário
      setFormData({
        estoque_id: '',
        lote_id: '',
        quantidade: '',
        motivo: '',
        observacao: '',
        paciente_id: '',
        paciente_nome: '',
        paciente_cpf: '',
        medico_id: '',
        medico_nome: '',
        medico_crm: '',
        medico_especialidade_id: '',
        valor_unitario: produto.valor_unitario || 0
      })
      setIsOpen(false)

      if (onSuccess) {
        await onSuccess()
      }

      const linhaProfissional = formData.medico_nome
        ? `Profissional: ${formData.medico_nome}\n`
        : ''

      const mensagemSucesso = formData.paciente_id
        ? `✅ Baixa realizada e registrada no histórico do paciente!\n\n` +
          `Produto: ${produto.nome_comercial}\n` +
          `Paciente: ${formData.paciente_nome}\n` +
          linhaProfissional +
          `Localização: ${estoque.nome}\n` +
          `Lote: ${lote.numero_lote}\n` +
          `Quantidade: ${quantidade}\n` +
          `Valor total: R$ ${(quantidade * formData.valor_unitario).toFixed(2)}\n` +
          `Estoque total: ${novoEstoqueTotal}`
        : `✅ Baixa realizada com sucesso!\n\n` +
          `Produto: ${produto.nome_comercial}\n` +
          linhaProfissional +
          `Localização: ${estoque.nome}\n` +
          `Lote: ${lote.numero_lote}\n` +
          `Quantidade: ${quantidade}\n` +
          `Estoque total: ${novoEstoqueTotal}`

      alert(mensagemSucesso)

    } catch (err) {
      console.error('❌ Erro ao dar baixa:', err)
      setError(err.message)
      alert(`❌ Erro: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setError(null)
    setFormData({
      estoque_id: '',
      lote_id: '',
      quantidade: '',
      motivo: '',
      observacao: '',
      paciente_id: '',
      paciente_nome: '',
      paciente_cpf: '',
      medico_id: '',
      medico_nome: '',
      medico_crm: '',
      medico_especialidade_id: '',
      valor_unitario: produto.valor_unitario || 0
    })
    setLotes([])
    setSearchPaciente('')
    setPacientesFiltrados([])
    setShowPacientesList(false)
  }

  const loteEmUso = lotes.find(l => l.id === formData.lote_id)
  const estoqueEmUso = estoques.find(e => e.id === formData.estoque_id)
  const pacienteSelecionado = formData.paciente_id
    ? pacientesFiltrados.find(p => p.id === formData.paciente_id)
    : null
  const medicoSelecionado = formData.medico_id
    ? medicos.find(m => m.id === formData.medico_id)
    : null
  const pacienteObrigatorio = MOTIVOS_COM_PACIENTE.includes(formData.motivo)
  const profissionalObrigatorio = MOTIVOS_COM_PROFISSIONAL.includes(formData.motivo)

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('pt-BR')
    } catch {
      return '-'
    }
  }

  const getValidadeColor = (dataValidade) => {
    if (!dataValidade) return 'text-gray-500'
    
    const hoje = new Date()
    const validade = new Date(dataValidade)
    const diffDays = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return 'text-red-600 font-bold'
    if (diffDays <= 30) return 'text-red-500'
    if (diffDays <= 60) return 'text-yellow-600'
    return 'text-green-600'
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
        title="Dar baixa no estoque"
      >
        <MinusCircle className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MinusCircle className="h-5 w-5 text-red-600" />
              Baixa Manual de Estoque
            </DialogTitle>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-600">
                Produto: <span className="font-semibold">{produto.nome_comercial}</span>
              </p>
              <p className="text-xs text-gray-500">
                Estoque total: {produto.estoque_atual || 0} {produto.unidade_medida}
              </p>
              {user && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 rounded-lg">
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    Baixa será registrada como: <strong>{user.displayName || user.email}</strong>
                  </span>
                </div>
              )}
            </div>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Seleção de Localização */}
            <div>
              <Label htmlFor="estoque_id">Localização * (selecione primeiro)</Label>
              {estoques.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Carregando localizações...
                </div>
              ) : (
                <Select
                  value={formData.estoque_id}
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    estoque_id: value,
                    lote_id: ''
                  })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a localização..." />
                  </SelectTrigger>
                  <SelectContent>
                    {estoques.map((est) => (
                      <SelectItem key={est.id} value={est.id}>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-600" />
                          {est.nome} - {est.tipo}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {estoqueEmUso && (
                <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-green-900">
                      {estoqueEmUso.nome}
                    </span>
                    {estoqueEmUso.temperatura_controlada && (
                      <Badge className="bg-blue-100 text-blue-800 ml-2">
                        {estoqueEmUso.temperatura_min}°C a {estoqueEmUso.temperatura_max}°C
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Seleção de Lote */}
            {formData.estoque_id && (
              <div>
                <Label htmlFor="lote_id">Lote * (desta localização)</Label>
                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
                  </div>
                ) : lotes.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    Nenhum lote disponível nesta localização
                  </div>
                ) : (
                  <>
                    <Select
                      value={formData.lote_id}
                      onValueChange={(value) => setFormData({ ...formData, lote_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o lote..." />
                      </SelectTrigger>
                      <SelectContent>
                        {lotes.map((lote) => {
                          const validadeColor = getValidadeColor(lote.data_validade)
                          return (
                            <SelectItem key={lote.id} value={lote.id}>
                              <div className="flex items-center justify-between w-full">
                                <span className="font-medium">{lote.numero_lote}</span>
                                <span className="text-sm text-gray-600 ml-4">
                                  Disponível: {lote.quantidade_atual}
                                </span>
                                <span className={`text-xs ml-4 ${validadeColor}`}>
                                  Vence: {formatDate(lote.data_validade)}
                                </span>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    
                    {loteEmUso && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Número do Lote:</span>
                            <p className="font-semibold">{loteEmUso.numero_lote}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Disponível neste local:</span>
                            <p className="font-semibold text-blue-600">{loteEmUso.quantidade_atual}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Fabricação:</span>
                            <p>{formatDate(loteEmUso.data_fabricacao)}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Validade:</span>
                            <p className={getValidadeColor(loteEmUso.data_validade)}>
                              {formatDate(loteEmUso.data_validade)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Formulário completo após selecionar lote */}
            {formData.lote_id && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantidade">Quantidade a Dar Baixa *</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      min="1"
                      max={loteEmUso?.quantidade_atual || 999999}
                      value={formData.quantidade}
                      onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                      required
                      placeholder="Ex: 1"
                    />
                    {loteEmUso && formData.quantidade && (
                      <p className="text-xs text-gray-500 mt-1">
                        Restará neste local: {loteEmUso.quantidade_atual - parseInt(formData.quantidade || 0)} unidades
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="motivo">Motivo da Baixa *</Label>
                    <Select
                      value={formData.motivo}
                      onValueChange={(value) => setFormData({ ...formData, motivo: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MOTIVOS_BAIXA.map((motivo) => (
                          <SelectItem key={motivo} value={motivo}>
                            {motivo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 🆕 PROFISSIONAL — debita a baixa para um médico do CRM */}
                <div
                  className={`p-4 rounded-lg border space-y-3 ${
                    profissionalObrigatorio
                      ? 'bg-purple-50 border-purple-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Label htmlFor="medico_id" className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-purple-600" />
                    Profissional {profissionalObrigatorio ? '*' : '(opcional)'}
                  </Label>

                  {medicos.length === 0 ? (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                      <AlertCircle className="h-4 w-4 inline mr-2" />
                      Nenhum profissional ativo cadastrado. Cadastre em Médicos para
                      debitar baixas por profissional.
                    </div>
                  ) : (
                    <>
                      <Select
                        value={formData.medico_id || 'nenhum'}
                        onValueChange={handleSelecionarMedico}
                      >
                        <SelectTrigger id="medico_id">
                          <SelectValue placeholder="Selecione o profissional..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nenhum">Sem profissional</SelectItem>
                          {medicos.map((medico) => (
                            <SelectItem key={medico.id} value={medico.id}>
                              {medico.nome}
                              {medico.crm ? ` — CRM ${medico.crm}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <p className="text-xs text-gray-500">
                        {profissionalObrigatorio
                          ? 'Este motivo exige um profissional. O consumo entra no relatório Por Profissional.'
                          : 'Informe o profissional para que este consumo apareça no relatório Por Profissional.'}
                      </p>

                      {medicoSelecionado && (
                        <div className="p-3 bg-white rounded-lg border border-purple-200 text-sm">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="h-4 w-4 text-purple-600" />
                            <span className="font-semibold">{medicoSelecionado.nome}</span>
                            {medicoSelecionado.crm && (
                              <Badge variant="outline" className="text-xs">
                                CRM {medicoSelecionado.crm}
                              </Badge>
                            )}
                          </div>
                          {getEspecialidadeNome(
                            medicoSelecionado.especialidade_id || medicoSelecionado.especialidadeId
                          ) && (
                            <p className="text-xs text-gray-600 mt-1">
                              {getEspecialidadeNome(
                                medicoSelecionado.especialidade_id || medicoSelecionado.especialidadeId
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 🆕 SELEÇÃO DE PACIENTE - VERSÃO OTIMIZADA */}
                {pacienteObrigatorio && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                    <div className="pacientes-search-container">
                      <p className="text-sm font-medium text-blue-800 mb-2">
                        📋 Buscar Paciente *
                      </p>
                      
                      {/* Input de busca */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          value={searchPaciente}
                          onChange={(e) => {
                            setSearchPaciente(e.target.value)
                            setShowPacientesList(true)
                          }}
                          onFocus={() => setShowPacientesList(true)}
                          placeholder="Digite nome, telefone ou email (mín. 2 caracteres)..."
                          className="pl-10 pr-10"
                        />
                        {searchPaciente && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchPaciente('')
                              setPacientesFiltrados([])
                              setFormData(prev => ({
                                ...prev,
                                paciente_id: '',
                                paciente_nome: ''
                              }))
                            }}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Loading */}
                      {loadingPacientes && (
                        <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600"></div>
                          Buscando pacientes...
                        </div>
                      )}

                      {/* Lista de resultados */}
                      {showPacientesList && searchPaciente.length >= 2 && !loadingPacientes && (
                        <div className="mt-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                          {pacientesFiltrados.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                              Nenhum paciente encontrado
                            </div>
                          ) : (
                            <div className="divide-y">
                              {pacientesFiltrados.map((paciente) => (
                                <button
                                  key={paciente.id}
                                  type="button"
                                  onClick={() => handleSelecionarPaciente(paciente)}
                                  className="w-full p-3 hover:bg-blue-50 text-left transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium truncate">{paciente.nome_paciente}</span>
                                        <Badge variant="outline" className="text-xs flex-shrink-0">
                                          {paciente.status}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                          <Phone className="h-3 w-3" />
                                          {paciente.telefone}
                                        </span>
                                        {paciente.email && (
                                          <span className="flex items-center gap-1 truncate">
                                            <Mail className="h-3 w-3" />
                                            {paciente.email}
                                          </span>
                                        )}
                                      </div>
                                      {paciente.total_consumos > 0 && (
                                        <div className="mt-1 text-xs text-green-600">
                                          {paciente.total_consumos} consumo(s) • 
                                          Ticket médio: R$ {(paciente.ticket_medio_produtos || 0).toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {searchPaciente.length > 0 && searchPaciente.length < 2 && (
                        <p className="mt-2 text-xs text-gray-500">
                          Digite pelo menos 2 caracteres para buscar
                        </p>
                      )}
                    </div>

                    {/* Informações do paciente selecionado */}
                    {pacienteSelecionado && (
                      <div className="p-3 bg-white rounded-lg border border-blue-300">
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          Informações do Paciente
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Nome:</span>
                            <p className="font-semibold">{pacienteSelecionado.nome_paciente}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Telefone:</span>
                            <p>{pacienteSelecionado.telefone}</p>
                          </div>
                          {pacienteSelecionado.total_consumos > 0 && (
                            <>
                              <div>
                                <span className="text-gray-600">Total gasto:</span>
                                <p className="font-semibold text-green-600">
                                  R$ {(pacienteSelecionado.total_gasto_produtos || 0).toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-600">Ticket médio:</span>
                                <p className="font-semibold">
                                  R$ {(pacienteSelecionado.ticket_medio_produtos || 0).toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-600">Total de consumos:</span>
                                <p>{pacienteSelecionado.total_consumos}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Última compra:</span>
                                <p>{formatDate(pacienteSelecionado.ultima_compra_data)}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Valor unitário */}
                <div>
                  <Label htmlFor="valor_unitario">Valor Unitário (R$)</Label>
                  <Input
                    id="valor_unitario"
                    type="number"
                    step="0.01"
                    value={formData.valor_unitario}
                    onChange={(e) => setFormData({ ...formData, valor_unitario: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00"
                  />
                  {formData.quantidade && formData.valor_unitario > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Valor total: R$ {(parseInt(formData.quantidade) * formData.valor_unitario).toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Observações */}
                <div>
                  <Label htmlFor="observacao">Observações</Label>
                  <Textarea
                    id="observacao"
                    value={formData.observacao}
                    onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                    rows={3}
                    placeholder="Informações adicionais sobre esta baixa..."
                  />
                </div>

                {/* Resumo */}
                {formData.quantidade && formData.lote_id && estoqueEmUso && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-orange-900 mb-2">
                      📋 Resumo da Baixa
                    </p>
                    <div className="space-y-1 text-sm text-orange-800">
                      <p>
                        <strong>Produto:</strong> {produto.nome_comercial}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <strong>Localização:</strong> {estoqueEmUso.nome}
                      </p>
                      <p>
                        <strong>Lote:</strong> {loteEmUso?.numero_lote}
                      </p>
                      <p>
                        <strong>Quantidade:</strong> {formData.quantidade} {produto.unidade_medida}
                      </p>
                      {formData.valor_unitario > 0 && (
                        <p>
                          <strong>Valor total:</strong> R$ {(parseInt(formData.quantidade) * formData.valor_unitario).toFixed(2)}
                        </p>
                      )}
                      <p>
                        <strong>Motivo:</strong> {formData.motivo}
                      </p>
                      {formData.paciente_nome && (
                        <p>
                          <strong>Paciente:</strong> {formData.paciente_nome}
                        </p>
                      )}
                      {formData.medico_nome && (
                        <p>
                          <strong>Profissional:</strong> {formData.medico_nome}
                          {formData.medico_crm ? ` (CRM ${formData.medico_crm})` : ''}
                        </p>
                      )}
                      {user && (
                        <p>
                          <strong>Responsável:</strong> {user.displayName || user.email}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={
                  saving ||
                  !formData.estoque_id ||
                  !formData.lote_id ||
                  (pacienteObrigatorio && !formData.paciente_id) ||
                  (profissionalObrigatorio && !formData.medico_id)
                }
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {saving ? 'Processando...' : 'Confirmar Baixa'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
