import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Stethoscope,
  Package,
  Download,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Users,
  TrendingDown
} from 'lucide-react'
import estoqueDataService from '@/services/estoque/estoqueDataService'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const formatCurrency = (valor) =>
  (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
}

/**
 * Relatório de consumo de estoque agrupado por profissional (médico do CRM).
 *
 * Base: movimentações de SAÍDA que têm `medico_id` — gravado na baixa manual
 * quando um profissional é selecionado. Saídas sem profissional são contadas
 * à parte, para deixar explícita a cobertura do relatório.
 */
export default function RelatorioPorProfissional() {
  const [movimentacoes, setMovimentacoes] = useState([])
  const [produtos, setProdutos] = useState([])
  const [medicos, setMedicos] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandido, setExpandido] = useState(null)

  // Ano/mês correntes fixados na montagem: usar `new Date()` direto no corpo
  // quebraria a memoização dos agrupamentos (valor novo a cada render)
  const anoAtual = useMemo(() => new Date().getFullYear(), [])
  const [anoFilter, setAnoFilter] = useState(() => String(new Date().getFullYear()))
  const [mesFilter, setMesFilter] = useState(() => String(new Date().getMonth()))
  const [medicoFilter, setMedicoFilter] = useState('todos')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [movimentacoesData, produtosData, medicosData, especialidadesData] = await Promise.all([
        estoqueDataService.getMovimentacoes(),
        estoqueDataService.getProdutos(),
        estoqueDataService.getMedicos(),
        estoqueDataService.getEspecialidades()
      ])

      setMovimentacoes(movimentacoesData)
      setProdutos(produtosData)
      setMedicos(medicosData)
      setEspecialidades(especialidadesData)
    } catch (err) {
      console.error('Erro ao carregar relatório por profissional:', err)
      setError('Erro ao carregar os dados do relatório. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const produtosById = useMemo(
    () => new Map(produtos.map(p => [p.id, p])),
    [produtos]
  )

  const especialidadesById = useMemo(
    () => new Map(especialidades.map(e => [e.id, e])),
    [especialidades]
  )

  const medicosById = useMemo(
    () => new Map(medicos.map(m => [m.id, m])),
    [medicos]
  )

  // Todas as saídas, com data já parseada uma única vez
  const saidas = useMemo(() => {
    return movimentacoes
      .filter(mov => mov.tipo === 'saida')
      .map(mov => {
        const data = new Date(mov.data_movimentacao)
        return { ...mov, _data: Number.isNaN(data.getTime()) ? null : data }
      })
      .filter(mov => mov._data !== null)
  }, [movimentacoes])

  // Anos presentes nos dados + ano corrente
  const anosDisponiveis = useMemo(() => {
    const anos = new Set(saidas.map(mov => mov._data.getFullYear()))
    anos.add(anoAtual)
    return Array.from(anos).sort((a, b) => b - a)
  }, [saidas, anoAtual])

  // Saídas dentro do período selecionado
  const saidasNoPeriodo = useMemo(() => {
    const ano = parseInt(anoFilter, 10)
    return saidas.filter(mov => {
      if (mov._data.getFullYear() !== ano) return false
      if (mesFilter === 'todos') return true
      return mov._data.getMonth() === parseInt(mesFilter, 10)
    })
  }, [saidas, anoFilter, mesFilter])

  // Movimentações antigas podem não ter valor_total/valor_unitario gravados —
  // nesse caso o valor é reconstruído a partir do cadastro do produto
  const valorDaMovimentacao = useCallback((mov) => {
    if (typeof mov.valor_total === 'number' && !Number.isNaN(mov.valor_total)) {
      return mov.valor_total
    }
    const quantidade = mov.quantidade || 0
    const unitario =
      typeof mov.valor_unitario === 'number'
        ? mov.valor_unitario
        : produtosById.get(mov.produto_id)?.valor_unitario || 0
    return quantidade * unitario
  }, [produtosById])

  const nomeDoProduto = useCallback(
    (produtoId) => produtosById.get(produtoId)?.nome_comercial || 'Produto removido',
    [produtosById]
  )

  // Agrupamento por profissional
  const { linhas, semProfissional, totais } = useMemo(() => {
    const comProfissional = saidasNoPeriodo.filter(mov => mov.medico_id)
    const semProf = saidasNoPeriodo.filter(mov => !mov.medico_id)

    const grupos = new Map()

    comProfissional.forEach(mov => {
      if (!grupos.has(mov.medico_id)) {
        const medico = medicosById.get(mov.medico_id)
        const especialidadeId =
          mov.medico_especialidade_id ||
          medico?.especialidade_id ||
          medico?.especialidadeId ||
          ''

        grupos.set(mov.medico_id, {
          medico_id: mov.medico_id,
          // Nome gravado na movimentação: preserva o histórico mesmo se o
          // cadastro do médico for alterado ou removido depois
          nome: medico?.nome || mov.medico_nome || 'Profissional removido',
          crm: medico?.crm || mov.medico_crm || '',
          especialidade: especialidadesById.get(especialidadeId)?.nome || '',
          ativo: Boolean(medico),
          baixas: 0,
          itens: 0,
          valor: 0,
          pacientes: new Set(),
          produtos: new Map(),
          ultimaBaixa: null
        })
      }

      const grupo = grupos.get(mov.medico_id)
      const valor = valorDaMovimentacao(mov)
      const quantidade = mov.quantidade || 0

      grupo.baixas += 1
      grupo.itens += quantidade
      grupo.valor += valor
      if (mov.paciente_id) grupo.pacientes.add(mov.paciente_id)
      if (!grupo.ultimaBaixa || mov._data > grupo.ultimaBaixa) {
        grupo.ultimaBaixa = mov._data
      }

      const produtoKey = mov.produto_id || 'sem-produto'
      if (!grupo.produtos.has(produtoKey)) {
        grupo.produtos.set(produtoKey, {
          produto_id: mov.produto_id,
          nome: nomeDoProduto(mov.produto_id),
          quantidade: 0,
          valor: 0,
          ultimaBaixa: null
        })
      }
      const itemProduto = grupo.produtos.get(produtoKey)
      itemProduto.quantidade += quantidade
      itemProduto.valor += valor
      if (!itemProduto.ultimaBaixa || mov._data > itemProduto.ultimaBaixa) {
        itemProduto.ultimaBaixa = mov._data
      }
    })

    let lista = Array.from(grupos.values()).map(grupo => ({
      ...grupo,
      pacientes: grupo.pacientes.size,
      produtos: Array.from(grupo.produtos.values()).sort((a, b) => b.valor - a.valor)
    }))

    // Base da coluna "%": total do período com TODOS os profissionais, para que
    // filtrar um profissional mostre a participação real dele, e não 100%
    const valorPeriodo = lista.reduce((soma, item) => soma + item.valor, 0)

    if (medicoFilter !== 'todos') {
      lista = lista.filter(item => item.medico_id === medicoFilter)
    }

    lista.sort((a, b) => b.valor - a.valor || b.itens - a.itens)

    const valorTotal = lista.reduce((soma, item) => soma + item.valor, 0)
    const itensTotal = lista.reduce((soma, item) => soma + item.itens, 0)
    const baixasTotal = lista.reduce((soma, item) => soma + item.baixas, 0)

    return {
      linhas: lista,
      semProfissional: {
        baixas: semProf.length,
        itens: semProf.reduce((soma, mov) => soma + (mov.quantidade || 0), 0),
        valor: semProf.reduce((soma, mov) => soma + valorDaMovimentacao(mov), 0)
      },
      totais: {
        profissionais: lista.length,
        baixas: baixasTotal,
        itens: itensTotal,
        valor: valorTotal,
        valorPeriodo
      }
    }
  }, [
    saidasNoPeriodo,
    medicosById,
    especialidadesById,
    medicoFilter,
    valorDaMovimentacao,
    nomeDoProduto
  ])

  const rotuloPeriodo =
    mesFilter === 'todos' ? `Ano de ${anoFilter}` : `${MESES[parseInt(mesFilter, 10)]}/${anoFilter}`

  const sufixoArquivo =
    mesFilter === 'todos'
      ? anoFilter
      : `${anoFilter}-${String(parseInt(mesFilter, 10) + 1).padStart(2, '0')}`

  const baixarCSV = (nomeArquivo, linhasCsv) => {
    // BOM para o Excel pt-BR interpretar os acentos corretamente
    const blob = new Blob(['﻿' + linhasCsv.join('\n')], {
      type: 'text/csv;charset=utf-8;'
    })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', nomeArquivo)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportarResumo = () => {
    const headers = [
      'Profissional', 'CRM', 'Especialidade', 'Baixas',
      'Itens', 'Pacientes', 'Valor Total', 'Participação (%)'
    ]
    const linhasCsv = [
      headers.join(','),
      ...linhas.map(item =>
        [
          `"${item.nome}"`,
          `"${item.crm}"`,
          `"${item.especialidade}"`,
          item.baixas,
          item.itens,
          item.pacientes,
          `"${formatCurrency(item.valor)}"`,
          totais.valorPeriodo > 0
            ? ((item.valor / totais.valorPeriodo) * 100).toFixed(1)
            : '0.0'
        ].join(',')
      )
    ]
    baixarCSV(`consumo_por_profissional_resumo_${sufixoArquivo}.csv`, linhasCsv)
  }

  const exportarAnalitico = () => {
    const headers = [
      'Data', 'Profissional', 'CRM', 'Produto',
      'Quantidade', 'Valor', 'Motivo', 'Paciente', 'Localização', 'Usuário'
    ]

    const idsFiltrados = new Set(linhas.map(item => item.medico_id))
    const detalhe = saidasNoPeriodo
      .filter(mov => mov.medico_id && idsFiltrados.has(mov.medico_id))
      .sort((a, b) => b._data - a._data)

    const linhasCsv = [
      headers.join(','),
      ...detalhe.map(mov => {
        const medico = medicosById.get(mov.medico_id)
        return [
          `"${formatDate(mov.data_movimentacao)}"`,
          `"${medico?.nome || mov.medico_nome || ''}"`,
          `"${medico?.crm || mov.medico_crm || ''}"`,
          `"${nomeDoProduto(mov.produto_id)}"`,
          mov.quantidade || 0,
          `"${formatCurrency(valorDaMovimentacao(mov))}"`,
          `"${mov.motivo || ''}"`,
          `"${mov.paciente_nome || ''}"`,
          `"${mov.estoque_nome || ''}"`,
          `"${mov.usuario_nome || 'Sistema'}"`
        ].join(',')
      })
    ]
    baixarCSV(`consumo_por_profissional_analitico_${sufixoArquivo}.csv`, linhasCsv)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Estatísticas do período */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Profissionais com consumo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totais.profissionais}</div>
            <p className="text-xs text-gray-500 mt-1">{rotuloPeriodo}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Baixas registradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totais.baixas}</div>
            <p className="text-xs text-gray-500 mt-1">
              {totais.itens} {totais.itens === 1 ? 'item' : 'itens'} consumidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Valor consumido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totais.valor)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Média por profissional:{' '}
              {formatCurrency(totais.profissionais > 0 ? totais.valor / totais.profissionais : 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Saídas sem profissional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{semProfissional.baixas}</div>
            <p className="text-xs text-gray-500 mt-1">
              {formatCurrency(semProfissional.valor)} fora deste relatório
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-purple-600" />
              Consumo por Profissional — {rotuloPeriodo}
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={loadData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button
                onClick={exportarResumo}
                variant="outline"
                size="sm"
                disabled={linhas.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Resumo
              </Button>
              <Button
                onClick={exportarAnalitico}
                variant="outline"
                size="sm"
                disabled={linhas.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Analítico
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label className="text-xs text-gray-600">Mês</Label>
              <Select value={mesFilter} onValueChange={setMesFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Ano inteiro</SelectItem>
                  {MESES.map((mes, indice) => (
                    <SelectItem key={mes} value={String(indice)}>
                      {mes}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-gray-600">Ano</Label>
              <Select value={anoFilter} onValueChange={setAnoFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map(ano => (
                    <SelectItem key={ano} value={String(ano)}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-gray-600">Profissional</Label>
              <Select value={medicoFilter} onValueChange={setMedicoFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os profissionais</SelectItem>
                  {medicos.map(medico => (
                    <SelectItem key={medico.id} value={medico.id}>
                      {medico.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {semProfissional.baixas > 0 && (
            <Alert className="mb-4 bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 text-sm">
                {semProfissional.baixas} saída(s) no período não têm profissional
                atribuído ({semProfissional.itens} itens, {formatCurrency(semProfissional.valor)}) e
                por isso não aparecem abaixo. Selecione o profissional na baixa manual
                para incluí-las.
              </AlertDescription>
            </Alert>
          )}

          {/* Tabela */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>CRM</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead className="text-right">Baixas</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Pacientes</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead>Última baixa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                      <Users className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p>Nenhum consumo por profissional em {rotuloPeriodo}</p>
                      <p className="text-xs mt-1">
                        As baixas passam a aparecer aqui quando um profissional é
                        selecionado na baixa manual de estoque.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  linhas.map(item => {
                    const aberto = expandido === item.medico_id
                    const participacao =
                      totais.valorPeriodo > 0 ? (item.valor / totais.valorPeriodo) * 100 : 0

                    return [
                      <TableRow
                        key={item.medico_id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandido(aberto ? null : item.medico_id)}
                      >
                        <TableCell>
                          {aberto ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="h-3 w-3 text-purple-600" />
                            {item.nome}
                          </div>
                          {!item.ativo && (
                            <span className="text-xs text-gray-400">
                              cadastro inativo ou removido
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{item.crm || '-'}</TableCell>
                        <TableCell className="text-sm">{item.especialidade || '-'}</TableCell>
                        <TableCell className="text-right">{item.baixas}</TableCell>
                        <TableCell className="text-right font-semibold">{item.itens}</TableCell>
                        <TableCell className="text-right">{item.pacientes}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {formatCurrency(item.valor)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-xs">
                            {participacao.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatDate(item.ultimaBaixa)}
                        </TableCell>
                      </TableRow>,

                      aberto && (
                        <TableRow key={`${item.medico_id}-detalhe`} className="bg-gray-50">
                          <TableCell colSpan={10} className="p-4">
                            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              Produtos consumidos por {item.nome}
                            </p>
                            <div className="rounded-md border bg-white">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="text-right">Quantidade</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                    <TableHead>Última baixa</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {item.produtos.map(produto => (
                                    <TableRow key={produto.produto_id || produto.nome}>
                                      <TableCell className="text-sm">{produto.nome}</TableCell>
                                      <TableCell className="text-right text-sm font-semibold">
                                        {produto.quantidade}
                                      </TableCell>
                                      <TableCell className="text-right text-sm">
                                        {formatCurrency(produto.valor)}
                                      </TableCell>
                                      <TableCell className="text-sm text-gray-600">
                                        {formatDate(produto.ultimaBaixa)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    ]
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {linhas.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                {linhas.length} profissional(is) • {totais.baixas} baixa(s) • {totais.itens} item(ns)
              </span>
              <span className="flex items-center gap-2 font-semibold text-red-600">
                <TrendingDown className="h-4 w-4" />
                Total: {formatCurrency(totais.valor)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
