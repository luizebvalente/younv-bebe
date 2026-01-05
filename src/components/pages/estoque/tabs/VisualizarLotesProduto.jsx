import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Layers, Calendar, MapPin } from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'

export default function VisualizarLotesProduto({ produto }) {
  const [isOpen, setIsOpen] = useState(false)
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [estoques, setEstoques] = useState([])

  useEffect(() => {
    if (isOpen) {
      loadLotes()
      loadEstoques()
    }
  }, [isOpen])

  const loadLotes = async () => {
    try {
      setLoading(true)
      console.log('📦 Carregando lotes do produto:', produto.id)
      
      // Buscar TODOS os lotes e filtrar manualmente
      const todosLotes = await estoqueDataService.getLotes()
      console.log('📋 Total de lotes no sistema:', todosLotes.length)
      
      // Filtrar apenas os lotes deste produto
      const lotesDoProduto = todosLotes.filter(lote => lote.produto_id === produto.id)
      console.log('✅ Lotes do produto:', lotesDoProduto.length)
      
      // Ordenar por data de validade (mais próximo primeiro)
      const sorted = lotesDoProduto.sort((a, b) => {
        if (!a.data_validade) return 1
        if (!b.data_validade) return -1
        return new Date(a.data_validade) - new Date(b.data_validade)
      })
      
      setLotes(sorted)
    } catch (error) {
      console.error('❌ Erro ao carregar lotes:', error)
      setLotes([])
    } finally {
      setLoading(false)
    }
  }

  const loadEstoques = async () => {
    try {
      const data = await estoqueDataService.getEstoques()
      setEstoques(data)
    } catch (error) {
      console.error('Erro ao carregar estoques:', error)
      setEstoques([])
    }
  }

  const getEstoqueNome = (id) => {
    if (!id) return 'N/A'
    const estoque = estoques.find(e => e.id === id)
    return estoque ? estoque.nome : 'N/A'
  }

  const getValidadeStatus = (dataValidade) => {
    if (!dataValidade) return { label: 'Sem validade', color: 'bg-gray-100 text-gray-800' }

    const hoje = new Date()
    const validade = new Date(dataValidade)
    const diffTime = validade - hoje
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { label: 'Vencido', color: 'bg-red-100 text-red-800' }
    } else if (diffDays <= 30) {
      return { label: `${diffDays} dias`, color: 'bg-red-100 text-red-800' }
    } else if (diffDays <= 60) {
      return { label: `${diffDays} dias`, color: 'bg-yellow-100 text-yellow-800' }
    } else if (diffDays <= 90) {
      return { label: `${diffDays} dias`, color: 'bg-orange-100 text-orange-800' }
    } else {
      return { label: `${diffDays} dias`, color: 'bg-green-100 text-green-800' }
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('pt-BR')
    } catch (err) {
      return '-'
    }
  }

  const totalEstoque = lotes.reduce((total, lote) => total + (lote.quantidade_atual || 0), 0)

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        title="Ver lotes"
      >
        <Layers className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              Lotes do Produto
            </DialogTitle>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-600">
                Produto: <span className="font-semibold">{produto.nome_comercial}</span>
              </p>
              <p className="text-sm text-gray-600">
                Estoque Total: <span className="font-semibold text-blue-600">{totalEstoque} {produto.unidade_medida}</span>
              </p>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div>
            </div>
          ) : lotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Layers className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium">Nenhum lote cadastrado</p>
              <p className="text-sm mt-1">Use a "Entrada Rápida" para adicionar estoque</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número do Lote</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-right">Qtd. Inicial</TableHead>
                    <TableHead className="text-right">Qtd. Atual</TableHead>
                    <TableHead>Data Fabricação</TableHead>
                    <TableHead>Data Validade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotes.map((lote) => {
                    const validadeStatus = getValidadeStatus(lote.data_validade)
                    return (
                      <TableRow key={lote.id}>
                        <TableCell className="font-medium">
                          <Badge variant="outline">{lote.numero_lote}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <MapPin className="h-3 w-3" />
                            {getEstoqueNome(lote.estoque_id)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{lote.quantidade_inicial}</TableCell>
                        <TableCell className="text-right font-semibold">
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
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setIsOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
