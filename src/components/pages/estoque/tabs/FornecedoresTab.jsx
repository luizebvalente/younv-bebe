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
  Building2,
  AlertCircle,
  Phone,
  Mail
} from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'

export default function FornecedoresTab() {
  const [fornecedores, setFornecedores] = useState([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    contato: '',
    telefone: '',
    email: '',
    endereco: '',
    especialidade: '',
    observacoes: '',
    ativo: true
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await estoqueDataService.getFornecedores()
      setFornecedores(data)
      console.log('Fornecedores carregados:', data)
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err)
      setError('Erro ao carregar fornecedores. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setSaving(true)
      setError(null)

      if (editingItem) {
        await estoqueDataService.updateFornecedor(editingItem.id, formData)
      } else {
        await estoqueDataService.createFornecedor(formData)
      }

      await loadData()
      handleCloseDialog()
    } catch (err) {
      console.error('Erro ao salvar fornecedor:', err)
      setError('Erro ao salvar fornecedor. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      nome: item.nome || '',
      cnpj: item.cnpj || '',
      contato: item.contato || '',
      telefone: item.telefone || '',
      email: item.email || '',
      endereco: item.endereco || '',
      especialidade: item.especialidade || '',
      observacoes: item.observacoes || '',
      ativo: item.ativo !== false
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este fornecedor?')) return

    try {
      await estoqueDataService.deleteFornecedor(id)
      await loadData()
    } catch (err) {
      console.error('Erro ao excluir fornecedor:', err)
      setError('Erro ao excluir fornecedor. Tente novamente.')
    }
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingItem(null)
    setError(null)
    setFormData({
      nome: '',
      cnpj: '',
      contato: '',
      telefone: '',
      email: '',
      endereco: '',
      especialidade: '',
      observacoes: '',
      ativo: true
    })
  }

  const formatCNPJ = (cnpj) => {
    if (!cnpj) return '-'
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  const formatPhone = (phone) => {
    if (!phone) return '-'
    return phone.replace(/^(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3')
  }

  const filteredFornecedores = fornecedores.filter(forn =>
    forn.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    forn.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    forn.especialidade?.toLowerCase().includes(searchTerm.toLowerCase())
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
              <Building2 className="h-5 w-5" />
              Fornecedores
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Fornecedor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="nome">Nome do Fornecedor *</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        required
                        placeholder="Ex: Farmácia ABC Ltda"
                      />
                    </div>

                    <div>
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        value={formData.cnpj}
                        onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                        placeholder="00.000.000/0000-00"
                      />
                    </div>

                    <div>
                      <Label htmlFor="contato">Nome do Contato</Label>
                      <Input
                        id="contato"
                        value={formData.contato}
                        onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                        placeholder="Nome da pessoa de contato"
                      />
                    </div>

                    <div>
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={formData.telefone}
                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="contato@fornecedor.com"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="endereco">Endereço</Label>
                      <Input
                        id="endereco"
                        value={formData.endereco}
                        onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                        placeholder="Rua, número, bairro, cidade - UF"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="especialidade">Especialidade / Produtos</Label>
                      <Input
                        id="especialidade"
                        value={formData.especialidade}
                        onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                        placeholder="Ex: Produtos dermatológicos, Vitaminas injetáveis..."
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="observacoes">Observações</Label>
                      <Textarea
                        id="observacoes"
                        value={formData.observacoes}
                        onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        rows={3}
                        placeholder="Informações adicionais"
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
                placeholder="Buscar fornecedores..."
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
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFornecedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Building2 className="h-12 w-12 text-gray-300" />
                        <p className="font-medium">Nenhum fornecedor cadastrado</p>
                        <p className="text-sm">Clique em "Novo Fornecedor" para começar</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFornecedores.map((fornecedor) => (
                    <TableRow key={fornecedor.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-blue-600" />
                          {fornecedor.nome}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatCNPJ(fornecedor.cnpj)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {fornecedor.contato || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone className="h-3 w-3" />
                          {formatPhone(fornecedor.telefone)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {fornecedor.especialidade || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={fornecedor.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {fornecedor.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(fornecedor)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(fornecedor.id)}
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
