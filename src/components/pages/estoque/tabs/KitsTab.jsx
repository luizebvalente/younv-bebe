import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Package,
  AlertCircle,
  CheckCircle,
  List,
  MinusCircle
} from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'

export default function KitsTab() {
  const [kits, setKits] = useState([])
  const [produtos, setProdutos] = useState([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isItensDialogOpen, setIsItensDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [selectedKit, setSelectedKit] = useState(null)
  const [kitItens, setKitItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    categoria: '',
    ativo: true
  })
  const [itemFormData, setItemFormData] = useState({
    produto_id: '',
    quantidade: 1
  })

  const categoriasKit = [
    'Protocolo de Soroterapia',
    'Protocolo Imunidade',
    'Protocolo Vitamina D',
    'Protocolo PRP',
    'Kit Botox',
    'Kit Implante Hormonal',
    'Kit Procedimento',
    'Outro'
  ]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [kitsData, produtosData] = await Promise.all([
        estoqueDataService.getKits(),
        estoqueDataService.getProdutos()
      ])

      setKits(kitsData)
      setProdutos(produtosData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const loadKitItens = async (kitId) => {
    try {
      const itens = await estoqueDataService.getKitItens(kitId)
      setKitItens(itens)
    } catch (err) {
      console.error('Erro ao carregar itens do kit:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setSaving(true)
      setError(null)

      if (editingItem) {
        await estoqueDataService.updateKit(editingItem.id, formData)
      } else {
        await estoqueDataService.createKit(formData)
      }

      await loadData()
      handleCloseDialog()
    } catch (err) {
      console.error('Erro ao salvar kit:', err)
      setError('Erro ao salvar kit. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async (e) => {
    e.preventDefault()

    try {
      setSaving(true)
      
      await estoqueDataService.createKitItem({
        kit_id: selectedKit.id,
        produto_id: itemFormData.produto_id,
        quantidade: parseInt(itemFormData.quantidade)
      })

      await loadKitItens(selectedKit.id)
      setItemFormData({ produto_id: '', quantidade: 1 })
    } catch (err) {
      console.error('Erro ao adicionar item:', err)
      setError('Erro ao adicionar item ao kit.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveItem = async (itemId) => {
    if (!confirm('Remover este item do kit?')) return

    try {
      await estoqueDataService.deleteKitItem(itemId)
      await loadKitItens(selectedKit.id)
    } catch (err) {
      console.error('Erro ao remover item:', err)
      setError('Erro ao remover item do kit.')
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      nome: item.nome || '',
      descricao: item.descricao || '',
      categoria: item.categoria || '',
      ativo: item.ativo !== false
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este kit?')) return

    try {
      await estoqueDataService.deleteKit(id)
      await loadData()
    } catch (err) {
      console.error('Erro ao excluir kit:', err)
      setError('Erro ao excluir kit. Tente novamente.')
    }
  }

  const handleViewItens = async (kit) => {
    setSelectedKit(kit)
    await loadKitItens(kit.id)
    setIsItensDialogOpen(true)
  }

  const handleBaixarKit = async (kitId) => {
    if (!confirm('Confirma a baixa deste kit do estoque?')) return

    try {
      setSaving(true)
      await estoqueDataService.baixarKit(kitId, 'Baixa manual via sistema')
      alert('Kit baixado do estoque com sucesso!')
      await loadData()
    } catch (err) {
      console.error('Erro ao baixar kit:', err)
      alert(err.message || 'Erro ao baixar kit do estoque.')
    } finally {
      setSaving(false)
    }
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingItem(null)
    setFormData({
      nome: '',
      descricao: '',
      categoria: '',
      ativo: true
    })
  }

  const handleCloseItensDialog = () => {
    setIsItensDialogOpen(false)
    setSelectedKit(null)
    setKitItens([])
    setItemFormData({ produto_id: '', quantidade: 1 })
  }

  const getProdutoNome = (id) => {
    const produto = produtos.find(p => p.id === id)
    return produto ? produto.nome_comercial : 'N/A'
  }

  const verificarDisponibilidade = async (kitId) => {
    try {
      const disponibilidade = await estoqueDataService.verificarDisponibilidadeKit(kitId)
      return disponibilidade.disponivel
    } catch (err) {
      console.error('Erro ao verificar disponibilidade:', err)
      return false
    }
  }

  const filteredKits = kits.filter(kit =>
    kit.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    kit.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
              <Package className="h-5 w-5" />
              Gestão de Kits e Protocolos
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Kit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? 'Editar Kit' : 'Novo Kit'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="nome">Nome do Kit *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                      placeholder="Ex: Protocolo Detox Completo"
                    />
                  </div>

                  <div>
                    <Label htmlFor="categoria">Categoria *</Label>
                    <select
                      id="categoria"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Selecione...</option>
                      {categoriasKit.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="descricao">Descrição</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      rows={3}
                      placeholder="Descreva o kit e sua finalidade"
                    />
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
                placeholder="Buscar kits..."
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
                  <TableHead>Nome do Kit</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500">
                      Nenhum kit encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredKits.map((kit) => (
                    <TableRow key={kit.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-purple-600" />
                          {kit.nome}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{kit.categoria}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                        {kit.descricao || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={kit.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {kit.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewItens(kit)}
                            title="Ver itens do kit"
                          >
                            <List className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleBaixarKit(kit.id)}
                            title="Baixar kit do estoque"
                          >
                            <MinusCircle className="h-4 w-4 text-orange-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(kit)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(kit.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Itens do Kit */}
      <Dialog open={isItensDialogOpen} onOpenChange={setIsItensDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Itens do Kit: {selectedKit?.nome}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Formulário para adicionar item */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Adicionar Item ao Kit</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddItem} className="flex gap-2">
                  <div className="flex-1">
                    <select
                      value={itemFormData.produto_id}
                      onChange={(e) => setItemFormData({ ...itemFormData, produto_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Selecione um produto...</option>
                      {produtos.map((produto) => (
                        <option key={produto.id} value={produto.id}>
                          {produto.nome_comercial}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min="1"
                      value={itemFormData.quantidade}
                      onChange={(e) => setItemFormData({ ...itemFormData, quantidade: e.target.value })}
                      placeholder="Qtd"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={saving}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Lista de itens */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kitItens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500">
                        Nenhum item adicionado ao kit
                      </TableCell>
                    </TableRow>
                  ) : (
                    kitItens.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {getProdutoNome(item.produto_id)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantidade}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleCloseItensDialog}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
