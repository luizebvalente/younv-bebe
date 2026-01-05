import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Package,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'
import EntradaRapidaEstoque from './EntradaRapidaEstoque'
import VisualizarLotesProduto from './VisualizarLotesProduto'
import BaixaManualEstoque from './BaixaManualEstoque'

export default function ProdutosTab() {
  const [produtos, setProdutos] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [categorias, setCategorias] = useState([])
  const [estoques, setEstoques] = useState([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    nome_comercial: '',
    nome_tecnico: '',
    categoria: '',
    fornecedor_id: '',
    unidade_medida: '',
    volume_unidade: '',
    valor_unitario: '',
    estoque_minimo: '',
    estoque_maximo: '',
    localizacao: '',
    descricao: '',
    ativo: true
  })

  const unidadesMedida = [
    'Ampola',
    'Frasco',
    'Caixa',
    'Unidade',
    'mL',
    'mg',
    'g',
    'kg',
    'L'
  ]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [produtosData, fornecedoresData, categoriasData, estoquesData] = await Promise.all([
        estoqueDataService.getProdutos(),
        estoqueDataService.getFornecedores(),
        estoqueDataService.getCategorias(),
        estoqueDataService.getEstoques()
      ])

      setProdutos(produtosData)
      setFornecedores(fornecedoresData)
      setCategorias(categoriasData)
      setEstoques(estoquesData)

      console.log('✅ Dados carregados:', {
        produtos: produtosData.length,
        fornecedores: fornecedoresData.length,
        categorias: categoriasData.length,
        estoques: estoquesData.length
      })
    } catch (err) {
      console.error('❌ Erro ao carregar dados:', err)
      setError('Erro ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validação adicional
    if (!formData.categoria) {
      setError('Por favor, selecione uma categoria')
      return
    }

    if (!formData.fornecedor_id) {
      setError('Por favor, selecione um fornecedor')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const data = {
        ...formData,
        valor_unitario: parseFloat(formData.valor_unitario) || 0,
        estoque_minimo: parseInt(formData.estoque_minimo) || 0,
        estoque_maximo: parseInt(formData.estoque_maximo) || 0,
        volume_unidade: parseFloat(formData.volume_unidade) || 0
      }

      console.log('💾 Salvando produto:', data)

      if (editingItem) {
        await estoqueDataService.updateProduto(editingItem.id, data)
        console.log('✅ Produto atualizado:', editingItem.id)
      } else {
        await estoqueDataService.createProduto(data)
        console.log('✅ Produto criado')
      }

      await loadData()
      handleCloseDialog()
      
      alert(editingItem ? '✅ Produto atualizado com sucesso!' : '✅ Produto criado com sucesso!')
    } catch (err) {
      console.error('❌ Erro ao salvar produto:', err)
      setError('Erro ao salvar produto. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      nome_comercial: item.nome_comercial || '',
      nome_tecnico: item.nome_tecnico || '',
      categoria: item.categoria || '',
      fornecedor_id: item.fornecedor_id || '',
      unidade_medida: item.unidade_medida || '',
      volume_unidade: item.volume_unidade || '',
      valor_unitario: item.valor_unitario || '',
      estoque_minimo: item.estoque_minimo || '',
      estoque_maximo: item.estoque_maximo || '',
      localizacao: item.localizacao || '',
      descricao: item.descricao || '',
      ativo: item.ativo !== false
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return

    try {
      await estoqueDataService.deleteProduto(id)
      await loadData()
      alert('✅ Produto excluído com sucesso!')
    } catch (err) {
      console.error('❌ Erro ao excluir produto:', err)
      setError('Erro ao excluir produto. Tente novamente.')
    }
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingItem(null)
    setError(null)
    setFormData({
      nome_comercial: '',
      nome_tecnico: '',
      categoria: '',
      fornecedor_id: '',
      unidade_medida: '',
      volume_unidade: '',
      valor_unitario: '',
      estoque_minimo: '',
      estoque_maximo: '',
      localizacao: '',
      descricao: '',
      ativo: true
    })
  }

  const getFornecedorNome = (id) => {
    const fornecedor = fornecedores.find(f => f.id === id)
    return fornecedor ? fornecedor.nome : 'N/A'
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const filteredProdutos = produtos.filter(produto =>
    produto.nome_comercial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.nome_tecnico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getEstoqueStatus = (produto) => {
    if (produto.estoque_atual === 0) {
      return { label: 'Zerado', color: 'bg-red-100 text-red-800', icon: AlertCircle }
    }
    if (produto.estoque_minimo && produto.estoque_atual <= produto.estoque_minimo) {
      return { label: 'Baixo', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle }
    }
    return { label: 'Normal', color: 'bg-green-100 text-green-800', icon: CheckCircle }
  }

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
              Gestão de Produtos
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? 'Editar Produto' : 'Novo Produto'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="nome_comercial">Nome Comercial *</Label>
                      <Input
                        id="nome_comercial"
                        value={formData.nome_comercial}
                        onChange={(e) => setFormData({ ...formData, nome_comercial: e.target.value })}
                        required
                        placeholder="Ex: Vitamina C 1000mg"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="nome_tecnico">Nome Técnico / Princípio Ativo</Label>
                      <Input
                        id="nome_tecnico"
                        value={formData.nome_tecnico}
                        onChange={(e) => setFormData({ ...formData, nome_tecnico: e.target.value })}
                        placeholder="Ex: Ácido Ascórbico"
                      />
                    </div>

                    <div>
                      <Label htmlFor="categoria">Categoria *</Label>
                      <Select
                        value={formData.categoria}
                        onValueChange={(value) => {
                          console.log('Categoria selecionada:', value)
                          setFormData({ ...formData, categoria: value })
                        }}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria..." />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">
                              Nenhuma categoria cadastrada
                            </div>
                          ) : (
                            categorias.map((cat) => (
                              <SelectItem key={cat.id} value={cat.nome}>
                                {cat.nome}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {categorias.length === 0 && (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️ Cadastre categorias primeiro na aba "Categorias"
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="fornecedor_id">Fornecedor *</Label>
                      <Select
                        value={formData.fornecedor_id}
                        onValueChange={(value) => {
                          console.log('Fornecedor selecionado:', value)
                          setFormData({ ...formData, fornecedor_id: value })
                        }}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um fornecedor..." />
                        </SelectTrigger>
                        <SelectContent>
                          {fornecedores.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">
                              Nenhum fornecedor cadastrado
                            </div>
                          ) : (
                            fornecedores.map((forn) => (
                              <SelectItem key={forn.id} value={forn.id}>
                                {forn.nome}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {fornecedores.length === 0 && (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️ Cadastre fornecedores primeiro na aba "Fornecedores"
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="unidade_medida">Unidade de Medida *</Label>
                      <Select
                        value={formData.unidade_medida}
                        onValueChange={(value) => setFormData({ ...formData, unidade_medida: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {unidadesMedida.map((unidade) => (
                            <SelectItem key={unidade} value={unidade}>
                              {unidade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="volume_unidade">Volume por Unidade</Label>
                      <Input
                        id="volume_unidade"
                        type="number"
                        step="0.01"
                        value={formData.volume_unidade}
                        onChange={(e) => setFormData({ ...formData, volume_unidade: e.target.value })}
                        placeholder="Ex: 10"
                      />
                    </div>

                    <div>
                      <Label htmlFor="valor_unitario">Valor Unitário (R$)</Label>
                      <Input
                        id="valor_unitario"
                        type="number"
                        step="0.01"
                        value={formData.valor_unitario}
                        onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <Label htmlFor="estoque_minimo">Estoque Mínimo</Label>
                      <Input
                        id="estoque_minimo"
                        type="number"
                        value={formData.estoque_minimo}
                        onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <Label htmlFor="estoque_maximo">Estoque Máximo</Label>
                      <Input
                        id="estoque_maximo"
                        type="number"
                        value={formData.estoque_maximo}
                        onChange={(e) => setFormData({ ...formData, estoque_maximo: e.target.value })}
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <Label htmlFor="localizacao">Localização no Estoque</Label>
                      <Select
                        value={formData.localizacao}
                        onValueChange={(value) => setFormData({ ...formData, localizacao: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma localização..." />
                        </SelectTrigger>
                        <SelectContent>
                          {estoques.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">
                              Nenhuma localização cadastrada
                            </div>
                          ) : (
                            estoques.map((estoque) => (
                              <SelectItem key={estoque.id} value={estoque.nome}>
                                {estoque.nome} - {estoque.tipo}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {estoques.length === 0 && (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️ Cadastre localizações primeiro na aba "Localizações"
                        </p>
                      )}
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="descricao">Descrição</Label>
                      <Textarea
                        id="descricao"
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        rows={3}
                        placeholder="Informações adicionais sobre o produto"
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
                placeholder="Buscar produtos..."
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
                  <TableHead>Nome Comercial</TableHead>
                  <TableHead>Nome Técnico</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Estoque Atual</TableHead>
                  <TableHead className="text-right">Valor Unit.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProdutos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="font-medium">Nenhum produto cadastrado</p>
                      <p className="text-sm mt-1">Clique em "Novo Produto" para começar</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProdutos.map((produto) => {
                    const status = getEstoqueStatus(produto)
                    const StatusIcon = status.icon
                    return (
                      <TableRow key={produto.id}>
                        <TableCell className="font-medium">{produto.nome_comercial}</TableCell>
                        <TableCell className="text-gray-600">{produto.nome_tecnico || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{produto.categoria}</Badge>
                        </TableCell>
                        <TableCell>{getFornecedorNome(produto.fornecedor_id)}</TableCell>
                        <TableCell>{produto.unidade_medida}</TableCell>
                        <TableCell className="text-right font-medium">
                          {produto.estoque_atual || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(produto.valor_unitario || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {/* Visualizar Lotes */}
                            <VisualizarLotesProduto produto={produto} />
                            
                            {/* Entrada Rápida */}
                            <EntradaRapidaEstoque 
                              produto={produto} 
                              estoques={estoques}
                              onSuccess={loadData}
                            />
                            
                            {/* Baixa Manual */}
                            <BaixaManualEstoque
                              produto={produto}
                              onSuccess={loadData}
                            />
                            
                            {/* Editar */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(produto)}
                              title="Editar produto"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            {/* Excluir */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(produto.id)}
                              title="Excluir produto"
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

          {/* Informações adicionais */}
          {filteredProdutos.length > 0 && (
            <div className="mt-4 text-sm text-gray-600">
              Mostrando {filteredProdutos.length} de {produtos.length} produtos
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
