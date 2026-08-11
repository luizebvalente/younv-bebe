import { lazy } from 'react'

// Cada deploy gera novos hashes nos chunks (Estoque-B4Nnbvre.js -> Estoque-BBpVbtNG.js).
// Uma aba aberta desde o deploy anterior continua com o index.html antigo em memória:
// ao navegar para uma rota lazy ela pede o arquivo velho, recebe 404 e o React.lazy
// rejeita, derrubando a árvore inteira (tela branca).
//
// Como o index.html é servido com `max-age=0, must-revalidate`, um reload já traz a
// referência nova. Este wrapper faz esse reload UMA vez por chunk — a flag em
// sessionStorage evita loop infinito caso o arquivo esteja realmente quebrado; nesse
// caso o erro é propagado para o ChunkErrorBoundary mostrar uma tela de verdade.

const PREFIXO_FLAG = 'chunk-reload:'

// sessionStorage pode lançar (modo privativo, storage desabilitado): nunca deixar
// o tratamento de erro virar um segundo erro
const lerFlag = (chave) => {
  try {
    return sessionStorage.getItem(chave)
  } catch {
    return null
  }
}

const gravarFlag = (chave) => {
  try {
    sessionStorage.setItem(chave, '1')
    return true
  } catch {
    return false
  }
}

const limparFlag = (chave) => {
  try {
    sessionStorage.removeItem(chave)
  } catch {
    // storage indisponível: nada a limpar
  }
}

export function lazyWithReload(factory, nomeChunk) {
  return lazy(async () => {
    const chave = PREFIXO_FLAG + nomeChunk

    try {
      const modulo = await factory()
      // Carregou: libera uma futura tentativa de reload para este chunk
      limparFlag(chave)
      return modulo
    } catch (error) {
      console.error(`Falha ao carregar o chunk "${nomeChunk}":`, error)

      // Já recarregamos por causa deste chunk e ainda falha: é erro real
      if (lerFlag(chave)) throw error

      if (!gravarFlag(chave)) throw error

      window.location.reload()

      // Promise que nunca resolve: segura o render até o reload acontecer,
      // em vez de piscar a tela de erro no meio do caminho
      return new Promise(() => {})
    }
  })
}
