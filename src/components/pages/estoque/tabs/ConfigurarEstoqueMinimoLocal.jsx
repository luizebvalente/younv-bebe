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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle,
  MapPin,
  Package,
  TrendingDown,
  Info,
  CheckCircle
} from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'
import estoqueMinimoPorLocalService from '@/services/estoque/estoqueMinimoPorLocal'

export default function ConfigurarEstoqueMinimoLocal() {
  const [isOpen, setIsOpen] = useState(false)
  const [configs, setConfigs] = useState([])
  const [produtos, setProdutos] = useState([])
  const [estoques, setEstoques] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editingConfig, setEditingConfig] = useState(null)

  const [formData, setFormData] = useState({
    produto_id: '',
    estoque_id: '',
    quantidade_minima: '',
    quantidade_ideal: '',
    prioridade: 'media',
    observacoes: '',
    ativo: true
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [configsData, produtosData, estoquesData] = await Promise.all([
        estoqueMinimoPorLocalService.getAll(),
        estoqueDataService.getProdutos(),
        estoqueDataService.getEstoques()
      ])

      setConfigs(configsData)
      setProdutos(produtosData)
      setEstoques(estoquesData)

      console.log('✅ Dados carregados:', {
        configs: configsData.length,
        produtos: produtosData.length,
        estoques: estoquesData.length
      })
    } catch (err) {
      console.error('❌ Erro ao carregar dados:', err)
      setError('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setSaving(true)
      setError(null)

      // Validações
      if (!formData.produto_id) {
        throw new Error('Selecione um produto')
      }

      if (!formData.estoque_id) {
        throw new Error('Selecione uma localização')
      }

      if (!formData.quantidade_minima || parseInt(formData.quantidade_minima) < 0) {
        throw new Error('Quantidade mínima inválida')
      }

      if (!formData.quantidade_ideal || parseInt(formData.quantidade_ideal) < parseInt(formData.quantidade_minima)) {
        throw new Error('Quantidade ideal deve ser maior ou igual ao mínimo')
      }

      await estoqueMinimoPorLocalService.setEstoqueMinimo(formData)

      await loadData()
      resetForm()

      alert('✅ Configuração salva com sucesso!')
    } catch (err) {
      console.error('❌ Erro ao salvar:', err)
      setError(err.message)
      alert(`❌ ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (config) => {
    setEditingConfig(config)
    setFormData({
      produto_id: config.produto_id,
      estoque_id: config.estoque_id,
      quantidade_minima: config.quantidade_minima,
      quantidade_ideal: config.quantidade_ideal,
      prioridade: config.prioridade,
      observacoes: config.observacoes || '',
      ativo: config.ativo
    })
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta configuração?')) return

    try {
      await estoqueMinimoPorLocalService.delete(id)
      await loadData()
      alert('✅ Configuração excluída!')
    } catch (err) {
      console.error('❌ Erro ao excluir:', err)
      alert('❌ Erro ao excluir configuração')
    }
  }

  const resetForm = () => {
    setEditingConfig(null)
    setFormData({
      produto_id: '',
      estoque_id: '',
      quantidade_minima: '',
      quantidade_ideal: '',
      prioridade: 'media',
      observacoes: '',
      ativo: true
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

  const getPrioridadeColor = (prioridade) => {
    switch (prioridade) {
      case 'alta':
        return 'bg-red-100 text-red-800'
      case 'media':
        return 'bg-yellow-100 text-yellow-800'
      case 'baixa':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="outline">
        <Settings className="h-4 w-4 mr-2" />
        Config. Mínimo por Local
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-8xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Configurar Estoque Mínimo por Localização
            </DialogTitle>
            <div className="text-sm text-gray-600 mt-2">
              <Info className="h-4 w-4 inline mr-1" />
              Configure o estoque mínimo desejado para cada produto em cada localização.
              O sistema irá alertá-lo quando o estoque ficar abaixo do configurado.
            </div>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Formulário de Configuração */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-sm">
                {editingConfig ? 'Editar Configuração' : 'Nova Configuração'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Produto */}
                  <div>
                    <Label htmlFor="produto_id">Produto *</Label>
                    <Select
                      value={formData.produto_id}
                      onValueChange={(value) => setFormData({ ...formData, produto_id: value })}
                      required
                      disabled={editingConfig !== null}
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

                  {/* Localização */}
                  <div>
                    <Label htmlFor="estoque_id">Localização *</Label>
                    <Select
                      value={formData.estoque_id}
                      onValueChange={(value) => setFormData({ ...formData, estoque_id: value })}
                      required
                      disabled={editingConfig !== null}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a localização..." />
                      </SelectTrigger>
                      <SelectContent>
                        {estoques.map((estoque) => (
                          <SelectItem key={estoque.id} value={estoque.id}>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {estoque.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantidade Mínima */}
                  <div>
                    <Label htmlFor="quantidade_minima">Quantidade Mínima *</Label>
                    <Input
                      id="quantidade_minima"
                      type="number"
                      min="0"
                      value={formData.quantidade_minima}
                      onChange={(e) => setFormData({ ...formData, quantidade_minima: e.target.value })}
                      required
                      placeholder="Ex: 10"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Quantidade abaixo da qual você será alertado
                    </p>
                  </div>

                  {/* Quantidade Ideal */}
                  <div>
                    <Label htmlFor="quantidade_ideal">Quantidade Ideal *</Label>
                    <Input
                      id="quantidade_ideal"
                      type="number"
                      min={formData.quantidade_minima || 0}
                      value={formData.quantidade_ideal}
                      onChange={(e) => setFormData({ ...formData, quantidade_ideal: e.target.value })}
                      required
                      placeholder="Ex: 20"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Quantidade ideal para ter sempre em estoque
                    </p>
                  </div>

                  {/* Prioridade */}
                  <div>
                    <Label htmlFor="prioridade">Prioridade *</Label>
                    <Select
                      value={formData.prioridade}
                      onValueChange={(value) => setFormData({ ...formData, prioridade: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alta">Alta - Crítico</SelectItem>
                        <SelectItem value="media">Média - Importante</SelectItem>
                        <SelectItem value="baixa">Baixa - Informativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      id="ativo"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="ativo" className="cursor-pointer">
                      Configuração Ativa
                    </Label>
                  </div>

                  {/* Observações */}
                  <div className="col-span-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      rows={2}
                      placeholder="Informações adicionais sobre esta configuração..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  {editingConfig && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancelar Edição
                    </Button>
                  )}
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Salvando...' : editingConfig ? 'Atualizar' : 'Adicionar Configuração'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Lista de Configurações */}
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Configurações Cadastradas ({configs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {configs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Settings className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p className="font-medium">Nenhuma configuração cadastrada</p>
                    <p className="text-sm mt-1">Configure o estoque mínimo para começar</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Localização</TableHead>
                          <TableHead className="text-right">Qtd. Mínima</TableHead>
                          <TableHead className="text-right">Qtd. Ideal</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {configs.map((config) => (
                          <TableRow key={config.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-blue-600" />
                                <span className="font-medium">
                                  {getProdutoNome(config.produto_id)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-green-600" />
                                {getEstoqueNome(config.estoque_id)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {config.quantidade_minima}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-blue-600">
                              {config.quantidade_ideal}
                            </TableCell>
                            <TableCell>
                              <Badge className={getPrioridadeColor(config.prioridade)}>
                                {config.prioridade === 'alta' ? 'Alta' :
                                 config.prioridade === 'media' ? 'Média' : 'Baixa'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {config.ativo ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Ativa
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-800">
                                  Inativa
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(config)}
                                  title="Editar"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(config.id)}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setIsOpen(false)} variant="outline">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
