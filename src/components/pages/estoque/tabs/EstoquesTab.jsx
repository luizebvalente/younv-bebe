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
  ShoppingCart,
  AlertCircle,
  MapPin
} from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'

export default function EstoquesTab() {
  const [estoques, setEstoques] = useState([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    nome: '',
    tipo: '',
    localizacao: '',
    temperatura_controlada: false,
    temperatura_min: '',
    temperatura_max: '',
    responsavel: '',
    descricao: '',
    ativo: true
  })

  const tiposEstoque = [
    'Almoxarifado Central',
    'Sala de Procedimentos',
    'Sala de Enfermagem',
    'Geladeira',
    'Freezer',
    'Estoque Manipulado',
    'Estoque para Venda',
    'Armário de Medicamentos',
    'Outro'
  ]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await estoqueDataService.getEstoques()
      setEstoques(data)
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
        temperatura_min: formData.temperatura_controlada ? parseFloat(formData.temperatura_min) || null : null,
        temperatura_max: formData.temperatura_controlada ? parseFloat(formData.temperatura_max) || null : null
      }

      if (editingItem) {
        await estoqueDataService.updateEstoque(editingItem.id, data)
      } else {
        await estoqueDataService.createEstoque(data)
      }

      await loadData()
      handleCloseDialog()
    } catch (err) {
      console.error('Erro ao salvar estoque:', err)
      setError('Erro ao salvar estoque. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      nome: item.nome || '',
      tipo: item.tipo || '',
      localizacao: item.localizacao || '',
      temperatura_controlada: item.temperatura_controlada || false,
      temperatura_min: item.temperatura_min || '',
      temperatura_max: item.temperatura_max || '',
      responsavel: item.responsavel || '',
      descricao: item.descricao || '',
      ativo: item.ativo !== false
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este estoque?')) return

    try {
      await estoqueDataService.deleteEstoque(id)
      await loadData()
    } catch (err) {
      console.error('Erro ao excluir estoque:', err)
      setError('Erro ao excluir estoque. Tente novamente.')
    }
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingItem(null)
    setFormData({
      nome: '',
      tipo: '',
      localizacao: '',
      temperatura_controlada: false,
      temperatura_min: '',
      temperatura_max: '',
      responsavel: '',
      descricao: '',
      ativo: true
    })
  }

  const filteredEstoques = estoques.filter(estoque =>
    estoque.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    estoque.tipo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    estoque.localizacao?.toLowerCase().includes(searchTerm.toLowerCase())
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
              <ShoppingCart className="h-5 w-5" />
              Gestão de Localizações de Estoque
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Localização
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? 'Editar Localização' : 'Nova Localização'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="nome">Nome da Localização *</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        required
                        placeholder="Ex: Geladeira da Sala 1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tipo">Tipo de Estoque *</Label>
                      <Select
                        value={formData.tipo}
                        onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposEstoque.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="localizacao">Localização Física</Label>
                      <Input
                        id="localizacao"
                        value={formData.localizacao}
                        onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                        placeholder="Ex: Andar 2, Sala 203"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="responsavel">Responsável</Label>
                      <Input
                        id="responsavel"
                        value={formData.responsavel}
                        onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                        placeholder="Nome do responsável"
                      />
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="temperatura_controlada"
                          checked={formData.temperatura_controlada}
                          onChange={(e) => setFormData({ ...formData, temperatura_controlada: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="temperatura_controlada" className="cursor-pointer">
                          Temperatura Controlada
                        </Label>
                      </div>
                    </div>

                    {formData.temperatura_controlada && (
                      <>
                        <div>
                          <Label htmlFor="temperatura_min">Temperatura Mínima (°C)</Label>
                          <Input
                            id="temperatura_min"
                            type="number"
                            step="0.1"
                            value={formData.temperatura_min}
                            onChange={(e) => setFormData({ ...formData, temperatura_min: e.target.value })}
                            placeholder="Ex: 2"
                          />
                        </div>

                        <div>
                          <Label htmlFor="temperatura_max">Temperatura Máxima (°C)</Label>
                          <Input
                            id="temperatura_max"
                            type="number"
                            step="0.1"
                            value={formData.temperatura_max}
                            onChange={(e) => setFormData({ ...formData, temperatura_max: e.target.value })}
                            placeholder="Ex: 8"
                          />
                        </div>
                      </>
                    )}

                    <div className="col-span-2">
                      <Label htmlFor="descricao">Descrição</Label>
                      <Textarea
                        id="descricao"
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        rows={3}
                        placeholder="Informações adicionais sobre este estoque"
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
                placeholder="Buscar localizações..."
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
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Localização Física</TableHead>
                  <TableHead>Temperatura</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEstoques.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      Nenhuma localização encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEstoques.map((estoque) => (
                    <TableRow key={estoque.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4 text-blue-600" />
                          {estoque.nome}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{estoque.tipo}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <MapPin className="h-3 w-3" />
                          {estoque.localizacao || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {estoque.temperatura_controlada ? (
                          <Badge className="bg-blue-100 text-blue-800">
                            {estoque.temperatura_min}°C a {estoque.temperatura_max}°C
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">Ambiente</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {estoque.responsavel || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={estoque.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {estoque.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(estoque)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(estoque.id)}
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
    </div>
  )
}
