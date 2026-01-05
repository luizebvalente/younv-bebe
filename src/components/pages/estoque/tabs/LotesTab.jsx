import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Layers,
  AlertCircle,
  Calendar,
  Package
} from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'

export default function LotesTab() {
  const [lotes, setLotes] = useState([])
  const [produtos, setProdutos] = useState([])
  const [estoques, setEstoques] = useState([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    produto_id: '',
    numero_lote: '',
    data_fabricacao: '',
    data_validade: '',
    quantidade_inicial: '',
    estoque_id: '',
    fornecedor_lote: '',
    nota_fiscal: '',
    valor_compra: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [lotesData, produtosData, estoquesData] = await Promise.all([
        estoqueDataService.getLotes(),
        estoqueDataService.getProdutos(),
        estoqueDataService.getEstoques()
      ])

      setLotes(lotesData)
      setProdutos(produtosData)
      setEstoques(estoquesData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setSaving(true)
      setError(null)

      const data = {
        ...formData,
        quantidade_inicial: parseInt(formData.quantidade_inicial) || 0,
        valor_compra: parseFloat(formData.valor_compra) || 0
      }

      if (editingItem) {
        await estoqueDataService.updateLote(editingItem.id, data)
      } else {
        await estoqueDataService.createLote(data)
      }

      await loadData()
      handleCloseDialog()
    } catch (err) {
      console.error('Erro ao salvar lote:', err)
      setError('Erro ao salvar lote. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      produto_id: item.produto_id || '',
      numero_lote: item.numero_lote || '',
      data_fabricacao: item.data_fabricacao?.split('T')[0] || '',
      data_validade: item.data_validade?.split('T')[0] || '',
      quantidade_inicial: item.quantidade_inicial || '',
      estoque_id: item.estoque_id || '',
      fornecedor_lote: item.fornecedor_lote || '',
      nota_fiscal: item.nota_fiscal || '',
      valor_compra: item.valor_compra || ''
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este lote?')) return

    try {
      await estoqueDataService.deleteLote(id)
      await loadData()
    } catch (err) {
      console.error('Erro ao excluir lote:', err)
      setError('Erro ao excluir lote. Tente novamente.')
    }
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingItem(null)
    setFormData({
      produto_id: '',
      numero_lote: '',
      data_fabricacao: '',
      data_validade: '',
      quantidade_inicial: '',
      estoque_id: '',
      fornecedor_lote: '',
      nota_fiscal: '',
      valor_compra: ''
    })
  }

  const getProdutoNome = (id) => {
    const produto = produtos.find(p => p.id === id)
    return produto ? produto.nome_comercial : 'N/A'
  }

  const getEstoqueNome = (id) => {
    const estoque = estoques.find(e => e.id === id)
    return estoque ? estoque.nome : 'N/A'
  }

  const getValidadeStatus = (dataValidade) => {
    if (!dataValidade) return { label: 'Sem validade', color: 'bg-gray-100 text-gray-800', dias: null }

    const hoje = new Date()
    const validade = new Date(dataValidade)
    const diffTime = validade - hoje
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { label: 'Vencido', color: 'bg-red-100 text-red-800', dias: diffDays }
    } else if (diffDays <= 30) {
      return { label: `${diffDays} dias`, color: 'bg-red-100 text-red-800', dias: diffDays }
    } else if (diffDays <= 60) {
      return { label: `${diffDays} dias`, color: 'bg-yellow-100 text-yellow-800', dias: diffDays }
    } else if (diffDays <= 90) {
      return { label: `${diffDays} dias`, color: 'bg-orange-100 text-orange-800', dias: diffDays }
    } else {
      return { label: `${diffDays} dias`, color: 'bg-green-100 text-green-800', dias: diffDays }
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR')
  }

  const filteredLotes = lotes.filter(lote => {
    const produtoNome = getProdutoNome(lote.produto_id).toLowerCase()
    const numeroLote = lote.numero_lote?.toLowerCase() || ''
    const search = searchTerm.toLowerCase()
    return produtoNome.includes(search) || numeroLote.includes(search)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Gestão de Lotes
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Lote
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? 'Editar Lote' : 'Novo Lote'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="produto_id">Produto *</Label>
                      <Select
                        value={formData.produto_id}
                        onValueChange={(value) => setFormData({ ...formData, produto_id: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o produto..." />
                        </SelectTrigger>
                        <SelectContent>
                          {produtos.map((produto) => (
                            <SelectItem key={produto.id} value={produto.id}>
                              {produto.nome_comercial}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="numero_lote">Número do Lote *</Label>
                      <Input
                        id="numero_lote"
                        value={formData.numero_lote}
                        onChange={(e) => setFormData({ ...formData, numero_lote: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="quantidade_inicial">Quantidade Inicial *</Label>
                      <Input
                        id="quantidade_inicial"
                        type="number"
                        value={formData.quantidade_inicial}
                        onChange={(e) => setFormData({ ...formData, quantidade_inicial: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="data_fabricacao">Data de Fabricação</Label>
                      <Input
                        id="data_fabricacao"
                        type="date"
                        value={formData.data_fabricacao}
                        onChange={(e) => setFormData({ ...formData, data_fabricacao: e.target.value })}
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
                      <Label htmlFor="estoque_id">Localização</Label>
                      <Select
                        value={formData.estoque_id}
                        onValueChange={(value) => setFormData({ ...formData, estoque_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {estoques.map((estoque) => (
                            <SelectItem key={estoque.id} value={estoque.id}>
                              {estoque.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="fornecedor_lote">Fornecedor do Lote</Label>
                      <Input
                        id="fornecedor_lote"
                        value={formData.fornecedor_lote}
                        onChange={(e) => setFormData({ ...formData, fornecedor_lote: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="nota_fiscal">Nota Fiscal</Label>
                      <Input
                        id="nota_fiscal"
                        value={formData.nota_fiscal}
                        onChange={(e) => setFormData({ ...formData, nota_fiscal: e.target.value })}
                      />
                    </div>

                    <div>
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

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Busca */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar lotes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Número do Lote</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead className="text-right">Qtd. Inicial</TableHead>
                  <TableHead className="text-right">Qtd. Atual</TableHead>
                  <TableHead>Data Fabricação</TableHead>
                  <TableHead>Data Validade</TableHead>
                  <TableHead>Status Validade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500">
                      Nenhum lote encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLotes.map((lote) => {
                    const validadeStatus = getValidadeStatus(lote.data_validade)
                    return (
                      <TableRow key={lote.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-400" />
                            {getProdutoNome(lote.produto_id)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{lote.numero_lote}</Badge>
                        </TableCell>
                        <TableCell>{getEstoqueNome(lote.estoque_id)}</TableCell>
                        <TableCell className="text-right">{lote.quantidade_inicial}</TableCell>
                        <TableCell className="text-right font-medium">
                          {lote.quantidade_atual || 0}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            {formatDate(lote.data_fabricacao)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            {formatDate(lote.data_validade)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={validadeStatus.color}>
                            {validadeStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(lote)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(lote.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
