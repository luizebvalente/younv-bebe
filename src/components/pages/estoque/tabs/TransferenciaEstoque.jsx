import { useState, useEffect } from 'react'
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
import { ArrowRightLeft, AlertCircle, Package, MapPin, Layers, User, Lightbulb } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import estoqueDataService from '@/services/estoque/estoqueDataService'
import { useAuth } from '@/contexts/AuthContext'

/**
 * 🆕 NOVO: Componente com suporte a dados pré-preenchidos
 * 
 * Props:
 * - estoques: lista de localizações
 * - produtos: lista de produtos
 * - lotes: lista de lotes
 * - onSuccess: callback após sucesso
 * - preenchido: objeto com dados pré-preenchidos (NOVO!)
 *   {
 *     produto_id: string,
 *     estoque_origem_id: string,
 *     estoque_destino_id: string,
 *     quantidade: number
 *   }
 */
export default function TransferenciaEstoque({ 
  estoques, 
  produtos, 
  lotes, 
  onSuccess,
  preenchido = null // 🆕 NOVO
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const { user } = useAuth()
  
  const [lotesDisponiveis, setLotesDisponiveis] = useState([])
  const [loteInfo, setLoteInfo] = useState(null)
  
  const [formData, setFormData] = useState({
    produto_id: '',
    lote_id: '',
    estoque_origem_id: '',
    estoque_destino_id: '',
    quantidade: '',
    motivo: 'Transferência entre locais',
    observacao: ''
  })

  // 🆕 NOVO: Preencher form quando abrir com dados pré-preenchidos
  useEffect(() => {
    if (isOpen) {
      if (preenchido) {
        console.log('📋 Pré-preenchendo formulário com:', preenchido)
        setFormData(prev => ({
          ...prev,
          produto_id: preenchido.produto_id || '',
          estoque_origem_id: preenchido.estoque_origem_id || '',
          estoque_destino_id: preenchido.estoque_destino_id || '',
          quantidade: preenchido.quantidade?.toString() || '',
          motivo: 'Reposição de estoque mínimo',
          observacao: preenchido.observacao || ''
        }))
      } else {
        resetForm()
      }
    }
  }, [isOpen, preenchido])

  useEffect(() => {
    if (formData.produto_id && formData.estoque_origem_id) {
      carregarLotesDisponiveis()
    } else {
      setLotesDisponiveis([])
      setLoteInfo(null)
    }
  }, [formData.produto_id, formData.estoque_origem_id])

  useEffect(() => {
    if (formData.lote_id) {
      const lote = lotes.find(l => l.id === formData.lote_id)
      setLoteInfo(lote)
    } else {
      setLoteInfo(null)
    }
  }, [formData.lote_id, lotes])

  const carregarLotesDisponiveis = () => {
    try {
      setLoading(true)
      
      const lotesDoEstoqueOrigem = lotes.filter(lote => 
        lote.produto_id === formData.produto_id && 
        lote.estoque_id === formData.estoque_origem_id &&
        lote.quantidade_atual > 0
      )
      
      const lotesOrdenados = lotesDoEstoqueOrigem.sort((a, b) => {
        if (!a.data_validade) return 1
        if (!b.data_validade) return -1
        return new Date(a.data_validade) - new Date(b.data_validade)
      })
      
      setLotesDisponiveis(lotesOrdenados)
      console.log('✅ Lotes disponíveis carregados:', lotesOrdenados.length)
      
      // 🆕 NOVO: Auto-selecionar primeiro lote se houver pré-preenchimento
      if (preenchido && lotesOrdenados.length > 0 && !formData.lote_id) {
        setFormData(prev => ({ ...prev, lote_id: lotesOrdenados[0].id }))
      }
    } catch (error) {
      console.error('❌ Erro ao carregar lotes:', error)
      setError('Erro ao carregar lotes disponíveis')
      setLotesDisponiveis([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setSaving(true)
      setError(null)

      console.log('🚀 Iniciando transferência de estoque...')

      // Validações
      const quantidade = parseInt(formData.quantidade)
      if (!quantidade || quantidade <= 0) {
        throw new Error('Quantidade deve ser maior que zero')
      }

      if (!formData.produto_id) {
        throw new Error('Selecione um produto')
      }

      if (!formData.lote_id) {
        throw new Error('Selecione um lote')
      }

      if (!formData.estoque_origem_id) {
        throw new Error('Selecione o estoque de origem')
      }

      if (!formData.estoque_destino_id) {
        throw new Error('Selecione o estoque de destino')
      }

      if (formData.estoque_origem_id === formData.estoque_destino_id) {
        throw new Error('Estoque de origem e destino não podem ser iguais')
      }

      if (!loteInfo) {
        throw new Error('Lote não encontrado')
      }

      // Verificar disponibilidade
      if (quantidade > loteInfo.quantidade_atual) {
        throw new Error(`Quantidade indisponível. Disponível: ${loteInfo.quantidade_atual}`)
      }

      // Informações do usuário
      const userInfo = user ? {
        id: user.uid,
        nome: user.displayName || user.email,
        email: user.email
      } : {
        id: 'sistema',
        nome: 'Sistema',
        email: 'sistema@younv.com'
      }

      console.log('👤 Usuário executando transferência:', userInfo)

      // Buscar nomes dos estoques
      const estoqueOrigem = estoques.find(e => e.id === formData.estoque_origem_id)
      const estoqueDestino = estoques.find(e => e.id === formData.estoque_destino_id)
      const produto = produtos.find(p => p.id === formData.produto_id)

      // 1. CRIAR MOVIMENTAÇÃO DE SAÍDA (do estoque de origem)
      const movimentacaoSaida = {
        produto_id: formData.produto_id,
        lote_id: formData.lote_id,
        tipo: 'saida',
        quantidade: quantidade,
        motivo: `Transferência para: ${estoqueDestino.nome}`,
        observacao: formData.observacao || '',
        usuario_id: userInfo.id,
        usuario_nome: userInfo.nome,
        usuario_email: userInfo.email,
        data_movimentacao: new Date().toISOString()
      }

      console.log('📝 Criando movimentação de saída:', movimentacaoSaida)
      await estoqueDataService.createMovimentacao(movimentacaoSaida)

      // 2. ATUALIZAR LOTE ORIGEM (reduzir quantidade)
      const novaQuantidadeLoteOrigem = loteInfo.quantidade_atual - quantidade
      console.log(`📊 Atualizando lote origem: ${loteInfo.quantidade_atual} - ${quantidade} = ${novaQuantidadeLoteOrigem}`)
      
      await estoqueDataService.updateLote(formData.lote_id, {
        quantidade_atual: novaQuantidadeLoteOrigem,
        estoque_id: formData.estoque_origem_id
      })

      // 3. CRIAR OU ATUALIZAR LOTE NO DESTINO
      const loteDestinoExistente = lotes.find(l =>
        l.numero_lote === loteInfo.numero_lote &&
        l.estoque_id === formData.estoque_destino_id &&
        l.produto_id === formData.produto_id
      )

      let loteDestinoId
      if (loteDestinoExistente) {
        const novaQuantidadeLoteDestino = (loteDestinoExistente.quantidade_atual || 0) + quantidade
        await estoqueDataService.updateLote(loteDestinoExistente.id, {
          quantidade_atual: novaQuantidadeLoteDestino
        })
        loteDestinoId = loteDestinoExistente.id
      } else {
        const novoLoteDestino = {
          produto_id: formData.produto_id,
          numero_lote: loteInfo.numero_lote,
          data_fabricacao: loteInfo.data_fabricacao,
          data_validade: loteInfo.data_validade,
          quantidade_inicial: quantidade,
          quantidade_atual: quantidade,
          estoque_id: formData.estoque_destino_id,
          fornecedor_lote: loteInfo.fornecedor_lote,
          nota_fiscal: loteInfo.nota_fiscal,
          valor_compra: loteInfo.valor_compra
        }
        const criado = await estoqueDataService.createLote(novoLoteDestino)
        loteDestinoId = criado?.id
      }

      // 4. CRIAR MOVIMENTAÇÃO DE ENTRADA (no estoque de destino)
      // lote_id = lote do DESTINO (antes usava o da origem e o histórico do destino saía errado)
      const movimentacaoEntrada = {
        produto_id: formData.produto_id,
        lote_id: loteDestinoId || formData.lote_id,
        tipo: 'entrada',
        quantidade: quantidade,
        motivo: `Transferência de: ${estoqueOrigem.nome}`,
        observacao: formData.observacao || '',
        usuario_id: userInfo.id,
        usuario_nome: userInfo.nome,
        usuario_email: userInfo.email,
        data_movimentacao: new Date().toISOString()
      }

      console.log('📝 Criando movimentação de entrada:', movimentacaoEntrada)
      await estoqueDataService.createMovimentacao(movimentacaoEntrada)

      console.log('✅ Transferência de estoque realizada com sucesso!')

      // Resetar formulário
      resetForm()
      setIsOpen(false)

      // Callback de sucesso
      if (onSuccess) {
        await onSuccess()
      }

      alert(`✅ Transferência realizada com sucesso!\n\n` +
            `Produto: ${produto.nome_comercial}\n` +
            `Lote: ${loteInfo.numero_lote}\n` +
            `Quantidade: ${quantidade}\n` +
            `De: ${estoqueOrigem.nome}\n` +
            `Para: ${estoqueDestino.nome}\n` +
            `Realizado por: ${userInfo.nome}`)

    } catch (err) {
      console.error('❌ Erro ao transferir:', err)
      setError(err.message)
      alert(`❌ Erro: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      produto_id: '',
      lote_id: '',
      estoque_origem_id: '',
      estoque_destino_id: '',
      quantidade: '',
      motivo: 'Transferência entre locais',
      observacao: ''
    })
    setLotesDisponiveis([])
    setLoteInfo(null)
    setError(null)
  }

  const handleClose = () => {
    setIsOpen(false)
    resetForm()
  }

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
        onClick={() => setIsOpen(true)}
        className={preenchido ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}
        size={preenchido ? 'sm' : 'default'}
      >
        <ArrowRightLeft className="h-4 w-4 mr-2" />
        {preenchido ? 'Transferir' : 'Transferir Estoque'}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-purple-600" />
              Transferência de Estoque entre Localizações
            </DialogTitle>
            {preenchido && (
              <Alert className="mt-2 bg-green-50 border-green-200">
                <Lightbulb className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <p className="font-semibold text-green-900">Sugestão de Transferência</p>
                  <p className="text-sm text-green-700 mt-1">
                    Formulário pré-preenchido com base na análise de estoque mínimo
                  </p>
                </AlertDescription>
              </Alert>
            )}
            <div className="mt-2">
              {user && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    Transferência será registrada como: <strong>{user.displayName || user.email}</strong>
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Seleção de Produto */}
            <div>
              <Label htmlFor="produto_id">Produto *</Label>
              <Select
                value={formData.produto_id}
                onValueChange={(value) => setFormData({ ...formData, produto_id: value, lote_id: '' })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto..." />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((produto) => (
                    <SelectItem key={produto.id} value={produto.id}>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        {produto.nome_comercial}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estoques Origem e Destino */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estoque_origem_id">Estoque de Origem *</Label>
                <Select
                  value={formData.estoque_origem_id}
                  onValueChange={(value) => setFormData({ ...formData, estoque_origem_id: value, lote_id: '' })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {estoques.map((estoque) => (
                      <SelectItem key={estoque.id} value={estoque.id}>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          {estoque.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="estoque_destino_id">Estoque de Destino *</Label>
                <Select
                  value={formData.estoque_destino_id}
                  onValueChange={(value) => setFormData({ ...formData, estoque_destino_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {estoques
                      .filter(e => e.id !== formData.estoque_origem_id)
                      .map((estoque) => (
                        <SelectItem key={estoque.id} value={estoque.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-green-600" />
                            {estoque.nome}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Seleção de Lote */}
            {formData.produto_id && formData.estoque_origem_id && (
              <div>
                <Label htmlFor="lote_id">Lote * (recomendado: vencimento mais próximo)</Label>
                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
                  </div>
                ) : lotesDisponiveis.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    Nenhum lote disponível neste estoque para o produto selecionado
                  </div>
                ) : (
                  <Select
                    value={formData.lote_id}
                    onValueChange={(value) => setFormData({ ...formData, lote_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o lote..." />
                    </SelectTrigger>
                    <SelectContent>
                      {lotesDisponiveis.map((lote) => {
                        const validadeColor = getValidadeColor(lote.data_validade)
                        return (
                          <SelectItem key={lote.id} value={lote.id}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                <span className="font-medium">{lote.numero_lote}</span>
                              </div>
                              <span className="text-sm text-gray-600">
                                Qtd: {lote.quantidade_atual}
                              </span>
                              <span className={`text-xs ${validadeColor}`}>
                                Val: {formatDate(lote.data_validade)}
                              </span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                )}

                {loteInfo && (
                  <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-semibold text-gray-900 mb-2">Informações do Lote</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Número:</span>
                        <p className="font-semibold">{loteInfo.numero_lote}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Disponível:</span>
                        <p className="font-semibold text-blue-600">{loteInfo.quantidade_atual}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Fabricação:</span>
                        <p>{formatDate(loteInfo.data_fabricacao)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Validade:</span>
                        <p className={getValidadeColor(loteInfo.data_validade)}>
                          {formatDate(loteInfo.data_validade)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quantidade */}
            <div>
              <Label htmlFor="quantidade">Quantidade a Transferir *</Label>
              <Input
                id="quantidade"
                type="number"
                min="1"
                max={loteInfo?.quantidade_atual || 999999}
                value={formData.quantidade}
                onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                required
                placeholder="Ex: 10"
              />
              {loteInfo && formData.quantidade && (
                <p className="text-xs text-gray-500 mt-1">
                  Restará no estoque de origem: {loteInfo.quantidade_atual - parseInt(formData.quantidade || 0)} unidades
                </p>
              )}
            </div>

            {/* Observação */}
            <div>
              <Label htmlFor="observacao">Observações</Label>
              <Textarea
                id="observacao"
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                rows={3}
                placeholder="Motivo ou informações adicionais sobre esta transferência..."
              />
            </div>

            {/* Preview da Transferência */}
            {formData.quantidade && formData.produto_id && formData.estoque_origem_id && formData.estoque_destino_id && loteInfo && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm font-medium text-purple-900 mb-3 flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Resumo da Transferência
                </p>
                <div className="space-y-2 text-sm text-purple-800">
                  <div className="flex items-center justify-between">
                    <span>Produto:</span>
                    <span className="font-semibold">
                      {produtos.find(p => p.id === formData.produto_id)?.nome_comercial}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Lote:</span>
                    <span className="font-semibold">{loteInfo.numero_lote}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Quantidade:</span>
                    <span className="font-semibold text-lg">{formData.quantidade}</span>
                  </div>
                  <div className="border-t border-purple-300 pt-2 mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-blue-600" />
                        De:
                      </span>
                      <span className="font-semibold">
                        {estoques.find(e => e.id === formData.estoque_origem_id)?.nome}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-green-600" />
                        Para:
                      </span>
                      <span className="font-semibold">
                        {estoques.find(e => e.id === formData.estoque_destino_id)?.nome}
                      </span>
                    </div>
                  </div>
                  {user && (
                    <div className="border-t border-purple-300 pt-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span>Responsável:</span>
                        <span className="font-semibold">{user.displayName || user.email}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={saving}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {saving ? 'Transferindo...' : 'Confirmar Transferência'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
