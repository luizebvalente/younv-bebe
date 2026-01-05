import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Package, 
  Layers, 
  BoxIcon, 
  AlertTriangle, 
  ShoppingCart, 
  Tag, 
  Building2, 
  ArrowLeftRight, 
  MapPin,
  FileText // 🆕 ADICIONADO: Ícone para Pedido de Compra
} from 'lucide-react'
import ProdutosTab from './tabs/ProdutosTab'
import LotesTab from './tabs/LotesTab'
import EstoquesTab from './tabs/EstoquesTab'
import KitsTab from './tabs/KitsTab'
import AlertasTab from './tabs/AlertasTab'
import CategoriasTab from './tabs/CategoriasTab'
import FornecedoresTab from './tabs/FornecedoresTab'
import MovimentacoesTab from './tabs/MovimentacoesTab'
import MapaEstoqueTab from './tabs/MapaEstoqueTab'
import DashboardEstoque from './DashboardEstoque'
import RelatorioPedidoCompra from './tabs/RelatorioPedidoCompra' // 🆕 ADICIONADO

export default function Estoque() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Estoque</h1>
          <p className="text-gray-500 mt-1">
            Controle completo de produtos, lotes, kits e movimentações
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-11 lg:w-auto lg:inline-grid">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="produtos" className="flex items-center gap-2">
            <BoxIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Produtos</span>
          </TabsTrigger>
          <TabsTrigger value="categorias" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Categorias</span>
          </TabsTrigger>
          <TabsTrigger value="fornecedores" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Fornecedores</span>
          </TabsTrigger>
          <TabsTrigger value="lotes" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Lotes</span>
          </TabsTrigger>
          <TabsTrigger value="estoques" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Localizações</span>
          </TabsTrigger>
          <TabsTrigger value="mapa" className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-blue-50">
            <MapPin className="h-4 w-4 text-purple-600" />
            <span className="hidden sm:inline text-purple-700 font-semibold">Mapa</span>
          </TabsTrigger>
          <TabsTrigger value="kits" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Kits</span>
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Movimentações</span>
          </TabsTrigger>
          <TabsTrigger value="alertas" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Alertas</span>
          </TabsTrigger>
          {/* 🆕 NOVA ABA: Pedido de Compra */}
          <TabsTrigger value="pedido-compra" className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50">
            <FileText className="h-4 w-4 text-green-600" />
            <span className="hidden sm:inline text-green-700 font-semibold">Pedido Compra</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardEstoque />
        </TabsContent>

        <TabsContent value="produtos" className="mt-6">
          <ProdutosTab />
        </TabsContent>

        <TabsContent value="categorias" className="mt-6">
          <CategoriasTab />
        </TabsContent>

        <TabsContent value="fornecedores" className="mt-6">
          <FornecedoresTab />
        </TabsContent>

        <TabsContent value="lotes" className="mt-6">
          <LotesTab />
        </TabsContent>

        <TabsContent value="estoques" className="mt-6">
          <EstoquesTab />
        </TabsContent>

        <TabsContent value="mapa" className="mt-6">
          <MapaEstoqueTab />
        </TabsContent>

        <TabsContent value="kits" className="mt-6">
          <KitsTab />
        </TabsContent>

        <TabsContent value="movimentacoes" className="mt-6">
          <MovimentacoesTab />
        </TabsContent>

        <TabsContent value="alertas" className="mt-6">
          <AlertasTab />
        </TabsContent>

        {/* 🆕 NOVO CONTEÚDO: Pedido de Compra */}
        <TabsContent value="pedido-compra" className="mt-6">
          <RelatorioPedidoCompra />
        </TabsContent>
      </Tabs>
    </div>
  )
}
