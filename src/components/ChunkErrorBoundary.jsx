import { Component } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Error boundary das rotas lazy.
 *
 * Sem ela, qualquer falha ao carregar o chunk de uma página (deploy novo com aba
 * antiga aberta, queda de rede no meio do download) desmonta a árvore do React e
 * o usuário fica com a tela branca, sem nenhuma pista do que houve.
 *
 * O reload automático de `lazyWithReload` resolve o caso comum; esta tela é o que
 * sobra quando o reload já foi tentado e o chunk continua inacessível.
 */
export default class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erro ao carregar a página:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    const falhaDeChunk = /dynamically imported module|Loading chunk|Importing a module script/i.test(
      this.state.error?.message || ''
    )

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto" />

          <h2 className="text-xl font-semibold text-gray-900">
            Não foi possível carregar esta página
          </h2>

          <p className="text-sm text-gray-600">
            {falhaDeChunk
              ? 'O sistema foi atualizado enquanto esta aba estava aberta. Recarregue para carregar a versão nova.'
              : 'Ocorreu um erro inesperado ao abrir esta página.'}
          </p>

          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Recarregar
          </Button>

          {this.state.error?.message && (
            <p className="text-xs text-gray-400 break-words pt-2">
              {this.state.error.message}
            </p>
          )}
        </div>
      </div>
    )
  }
}
