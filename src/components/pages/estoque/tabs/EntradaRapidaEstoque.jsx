import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { AlertCircle, Plus, Package } from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'

export default function EntradaRapidaEstoque({ produto, estoques, onSuccess }) {
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    quantidade: '',
    data_validade: '',
    numero_lote: '',
    estoque_id: '',
    fornecedor_lote: '',
    nota_fiscal: '',
    valor_compra: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setSaving(true)
      setError(null)

      console.log('🚀 Iniciando entrada de estoque...')
      console.log('📦 Produto:', produto)
      console.log('📝 Dados do formulário:', formData)

      // Validações básicas
      const quantidade = parseInt(formData.quantidade)
      if (!quantidade || quantidade <= 0) {
        throw new Error('Quantidade deve ser maior que zero')
      }

      if (!formData.data_validade) {
        throw new Error('Data de validade é obrigatória')
      }

      // Localização obrigatória: lote sem estoque_id contava no estoque total mas
      // ficava INVISÍVEL para Baixa e Transferência (que filtram por localização)
      if (!formData.estoque_id) {
        throw new Error('Selecione a localização (estoque) da entrada')
      }

      // Mesclar com lote existente de mesmo número na mesma localização
      // (antes cada entrada criava um lote novo, duplicando o mesmo lote físico)
      const numeroLote = formData.numero_lote || `LOTE-${Date.now()}`
      const lotesExistentes = await estoqueDataService.getLotesByProduto(produto.id)
      const loteExistente = formData.numero_lote
        ? lotesExistentes.find(l => l.numero_lote === numeroLote && l.estoque_id === formData.estoque_id)
        : null

      if (loteExistente) {
        await estoqueDataService.updateLote(loteExistente.id, {
          quantidade_atual: (loteExistente.quantidade_atual || 0) + quantidade,
          quantidade_inicial: (loteExistente.quantidade_inicial || 0) + quantidade,
          data_validade: formData.data_validade || loteExistente.data_validade
        })
      } else {
        const loteData = {
          produto_id: produto.id,
          numero_lote: numeroLote,
          quantidade_inicial: quantidade,
          data_validade: formData.data_validade,
          data_fabricacao: new Date().toISOString().split('T')[0],
          estoque_id: formData.estoque_id,
          fornecedor_lote: formData.fornecedor_lote || '',
          nota_fiscal: formData.nota_fiscal || '',
          valor_compra: parseFloat(formData.valor_compra) || 0
        }
        await estoqueDataService.createLote(loteData)
      }

      // Atualizar estoque do produto de forma simples e direta
      const estoqueAtual = produto.estoque_atual || 0
      const novoEstoque = estoqueAtual + quantidade
      
      console.log(`📊 Atualizando estoque: ${estoqueAtual} + ${quantidade} = ${novoEstoque}`)
      
      await estoqueDataService.updateProduto(produto.id, {
        estoque_atual: novoEstoque
      })
      console.log('✅ Estoque do produto atualizado')

      // Resetar formulário
      setFormData({
        quantidade: '',
        data_validade: '',
        numero_lote: '',
        estoque_id: '',
        fornecedor_lote: '',
        nota_fiscal: '',
        valor_compra: ''
      })
      setIsOpen(false)

      // Callback de sucesso para recarregar a lista
      if (onSuccess) {
        await onSuccess()
      }

      alert(`✅ Entrada realizada com sucesso!\n\n` +
            `Produto: ${produto.nome_comercial}\n` +
            `Lote: ${numeroLote}\n` +
            `Quantidade adicionada: ${quantidade}\n` +
            `Estoque anterior: ${estoqueAtual}\n` +
            `Novo estoque: ${novoEstoque}`)
      
    } catch (err) {
      console.error('❌ ERRO ao adicionar estoque:', {
        message: err.message,
        stack: err.stack,
        error: err
      })
      
      const errorMessage = err.message || 'Erro desconhecido ao adicionar estoque'
      setError(errorMessage)
      alert(`❌ Erro: ${errorMessage}\n\nVerifique o console do navegador (F12) para mais detalhes.`)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setError(null)
    setFormData({
      quantidade: '',
      data_validade: '',
      numero_lote: '',
      estoque_id: '',
      fornecedor_lote: '',
      nota_fiscal: '',
      valor_compra: ''
    })
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
        title="Adicionar estoque"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              Entrada Rápida de Estoque
            </DialogTitle>
            <p className="text-sm text-gray-600 mt-2">
              Produto: <span className="font-semibold">{produto.nome_comercial}</span>
            </p>
            <p className="text-xs text-gray-500">
              Estoque atual: {produto.estoque_atual || 0} {produto.unidade_medida}
            </p>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantidade">Quantidade a Adicionar *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min="1"
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                  required
                  placeholder="Ex: 50"
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="data_validade">Data de Validade *</Label>
                <Input
                  id="data_validade"
                  type="date"
                  value={formData.data_validade}
                  onChange={(e) => setFormData({ ...formData, data_validade: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="numero_lote">Número do Lote</Label>
                <Input
                  id="numero_lote"
                  value={formData.numero_lote}
                  onChange={(e) => setFormData({ ...formData, numero_lote: e.target.value })}
                  placeholder="Deixe vazio para gerar automático"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Opcional - será gerado automaticamente se vazio
                </p>
              </div>

              <div>
                <Label htmlFor="estoque_id">Localização</Label>
                <Select
                  value={formData.estoque_id}
                  onValueChange={(value) => setFormData({ ...formData, estoque_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {estoques && estoques.length > 0 ? (
                      estoques.map((est) => (
                        <SelectItem key={est.id} value={est.id}>
                          {est.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-gray-500">
                        Nenhuma localização cadastrada
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="fornecedor_lote">Fornecedor</Label>
                <Input
                  id="fornecedor_lote"
                  value={formData.fornecedor_lote}
                  onChange={(e) => setFormData({ ...formData, fornecedor_lote: e.target.value })}
                  placeholder="Nome do fornecedor"
                />
              </div>

              <div>
                <Label htmlFor="nota_fiscal">Nota Fiscal</Label>
                <Input
                  id="nota_fiscal"
                  value={formData.nota_fiscal}
                  onChange={(e) => setFormData({ ...formData, nota_fiscal: e.target.value })}
                  placeholder="Número da NF"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="valor_compra">Valor de Compra (R$)</Label>
                <Input
                  id="valor_compra"
                  type="number"
                  step="0.01"
                  value={formData.valor_compra}
                  onChange={(e) => setFormData({ ...formData, valor_compra: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            {formData.quantidade && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900 font-medium">
                  📦 Novo estoque após entrada:
                </p>
                <p className="text-lg font-bold text-blue-700 mt-1">
                  {(produto.estoque_atual || 0) + (parseInt(formData.quantidade) || 0)} {produto.unidade_medida}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? 'Adicionando...' : 'Adicionar ao Estoque'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
