import { useState, useEffect, useCallback } from 'react'
import estoqueDataService from '@/services/estoque/estoqueDataService'

/**
 * Hook customizado para gerenciar alertas de estoque
 */
export function useEstoqueAlertas() {
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadAlertas = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await estoqueDataService.getAlertas()
      
      // Ordenar por prioridade e data
      const alertasOrdenados = data.sort((a, b) => {
        const prioridadeOrder = { alta: 0, media: 1, baixa: 2 }
        const prioridadeA = prioridadeOrder[a.prioridade] || 3
        const prioridadeB = prioridadeOrder[b.prioridade] || 3
        
        if (prioridadeA !== prioridadeB) {
          return prioridadeA - prioridadeB
        }
        
        return new Date(b.data_criacao) - new Date(a.data_criacao)
      })
      
      setAlertas(alertasOrdenados)
    } catch (err) {
      console.error('Erro ao carregar alertas:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAlertas()
    
    // Atualizar alertas a cada 5 minutos
    const interval = setInterval(loadAlertas, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [loadAlertas])

  const marcarVisualizado = async (alertaId) => {
    try {
      await estoqueDataService.marcarAlertaVisualizado(alertaId)
      await loadAlertas()
    } catch (err) {
      console.error('Erro ao marcar alerta como visualizado:', err)
      throw err
    }
  }

  const deletarAlerta = async (alertaId) => {
    try {
      await estoqueDataService.deleteAlerta(alertaId)
      await loadAlertas()
    } catch (err) {
      console.error('Erro ao deletar alerta:', err)
      throw err
    }
  }

  const gerarAlertas = async () => {
    try {
      setLoading(true)
      await estoqueDataService.gerarAlertas()
      await loadAlertas()
    } catch (err) {
      console.error('Erro ao gerar alertas:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const alertasNaoVisualizados = alertas.filter(a => !a.visualizado)
  const alertasAlta = alertas.filter(a => a.prioridade === 'alta' && !a.visualizado)
  const alertasMedia = alertas.filter(a => a.prioridade === 'media' && !a.visualizado)
  const alertasBaixa = alertas.filter(a => a.prioridade === 'baixa' && !a.visualizado)

  return {
    alertas,
    alertasNaoVisualizados,
    alertasAlta,
    alertasMedia,
    alertasBaixa,
    loading,
    error,
    marcarVisualizado,
    deletarAlerta,
    gerarAlertas,
    refresh: loadAlertas
  }
}
