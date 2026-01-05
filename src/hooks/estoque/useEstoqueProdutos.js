import { useState, useEffect, useCallback } from 'react'
import estoqueDataService from '@/services/estoque/estoqueDataService'

/**
 * Hook customizado para gerenciar produtos do estoque
 */
export function useEstoqueProdutos() {
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadProdutos = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await estoqueDataService.getProdutos()
      setProdutos(data)
    } catch (err) {
      console.error('Erro ao carregar produtos:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProdutos()
  }, [loadProdutos])

  const createProduto = async (data) => {
    try {
      const result = await estoqueDataService.createProduto(data)
      await loadProdutos()
      return result
    } catch (err) {
      console.error('Erro ao criar produto:', err)
      throw err
    }
  }

  const updateProduto = async (id, data) => {
    try {
      const result = await estoqueDataService.updateProduto(id, data)
      await loadProdutos()
      return result
    } catch (err) {
      console.error('Erro ao atualizar produto:', err)
      throw err
    }
  }

  const deleteProduto = async (id) => {
    try {
      await estoqueDataService.deleteProduto(id)
      await loadProdutos()
    } catch (err) {
      console.error('Erro ao deletar produto:', err)
      throw err
    }
  }

  return {
    produtos,
    loading,
    error,
    createProduto,
    updateProduto,
    deleteProduto,
    refresh: loadProdutos
  }
}
