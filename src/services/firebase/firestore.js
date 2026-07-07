// Serviços do Firestore - VERSÃO CORRIGIDA
import { 
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db } from './config'

// Logger condicional — silencia em produção para evitar custo de serializar payloads gigantes no DevTools
const DEV = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
const log = (...args) => { if (DEV) console.log(...args) }

class FirestoreService {
  // Métodos genéricos para CRUD

  // CORREÇÃO: Obter todos os documentos de uma coleção com ordenação adequada
  async getAll(collectionName, orderByField = 'createdAt', orderDirection = 'desc') {
    try {
      // CORREÇÃO: Para leads, usar 'dataRegistroContato' como campo de ordenação principal
      if (collectionName === 'leads') {
        orderByField = 'dataRegistroContato'
      }

      log(`🔍 Buscando ${collectionName} ordenados por ${orderByField} ${orderDirection}`)

      const q = query(
        collection(db, collectionName),
        orderBy(orderByField, orderDirection)
      )
      const querySnapshot = await getDocs(q)

      const results = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Converter timestamps para strings ISO
        ...this.convertTimestamps(doc.data())
      }))

      log(`✅ Encontrados ${results.length} documentos em ${collectionName}`)
      return results
    } catch (error) {
      console.error(`❌ Erro ao buscar ${collectionName}:`, error)

      // CORREÇÃO: Se der erro na ordenação, tentar buscar sem ordenação
      if (error.code === 'failed-precondition' || error.message.includes('index')) {
        log(`⚠️ Tentando buscar ${collectionName} sem ordenação...`)
        try {
          const querySnapshot = await getDocs(collection(db, collectionName))
          const results = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            ...this.convertTimestamps(doc.data())
          }))
          
          // Ordenar manualmente no cliente
          if (collectionName === 'leads') {
            results.sort((a, b) => {
              const dateA = new Date(a.dataRegistroContato || a.createdAt || 0)
              const dateB = new Date(b.dataRegistroContato || b.createdAt || 0)
              return dateB - dateA // Mais recente primeiro
            })
          }
          
          log(`✅ Busca sem ordenação bem-sucedida: ${results.length} documentos`)
          return results
        } catch (fallbackError) {
          console.error(`❌ Erro mesmo sem ordenação:`, fallbackError)
          throw fallbackError
        }
      }
      throw error
    }
  }

  // Obter documento por ID
  async getById(collectionName, id) {
    try {
      const docRef = doc(db, collectionName, id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          ...this.convertTimestamps(docSnap.data())
        }
      }
      return null
    } catch (error) {
      console.error(`❌ Erro ao buscar documento ${id} em ${collectionName}:`, error)
      throw error
    }
  }

  // OTIMIZADO: 1 round-trip (era 2 — addDoc + getById). Retorna o payload + id; o caller
  // resolve timestamps localmente e atualiza o estado de forma otimista.
  async create(collectionName, data) {
    try {
      const docData = {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
      if (collectionName === 'leads' && !data.dataRegistroContato) {
        docData.dataRegistroContato = new Date().toISOString()
      }

      const docRef = await addDoc(collection(db, collectionName), docData)
      log(`✅ Documento criado em ${collectionName}: ${docRef.id}`)

      // Retorna sem reler do servidor
      const nowIso = new Date().toISOString()
      return {
        id: docRef.id,
        ...docData,
        createdAt: nowIso,
        updatedAt: nowIso
      }
    } catch (error) {
      console.error(`❌ Erro ao criar documento em ${collectionName}:`, error)
      throw error
    }
  }

  // OTIMIZADO: 1 round-trip ao Firestore (era 3). updateDoc lança erro se o doc não existir,
  // então não precisa do getDoc prévio. Não fazemos getDoc final — o caller já tem os dados
  // que enviou e atualiza o estado local de forma otimista.
  async update(collectionName, id, data) {
    const docRef = doc(db, collectionName, id)

    // PREPARAR dados — remover undefined que o Firestore rejeita
    const updateData = { ...data, updatedAt: serverTimestamp() }
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key]
    })

    try {
      log(`📝 FIRESTORE: Atualizando ${id} em ${collectionName}`)
      await updateDoc(docRef, updateData)

      // Retorna o payload enviado + id. updatedAt fica como ISO local
      // (o serverTimestamp real é resolvido no Firestore mas o caller não precisa dele agora).
      return {
        id,
        ...updateData,
        updatedAt: new Date().toISOString()
      }
    } catch (error) {
      // Retry simples para erros transitórios
      if (error.code === 'permission-denied' || error.code === 'unavailable') {
        log('🔄 FIRESTORE: retry após erro transitório...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        await updateDoc(docRef, updateData)
        return { id, ...updateData, updatedAt: new Date().toISOString() }
      }
      console.error(`❌ FIRESTORE: erro ao atualizar ${id} em ${collectionName}:`, error.message)
      throw error
    }
  }
  // Deletar documento
  async delete(collectionName, id) {
    try {
      const docRef = doc(db, collectionName, id)
      await deleteDoc(docRef)
      log(`✅ Documento ${id} deletado de ${collectionName}`)
      return true
    } catch (error) {
      console.error(`❌ Erro ao deletar documento ${id} em ${collectionName}:`, error)
      throw error
    }
  }

  // Buscar com filtros
  async getWhere(collectionName, field, operator, value) {
    try {
      log(`🔍 Buscando ${collectionName} onde ${field} ${operator} ${value}`)

      const q = query(
        collection(db, collectionName),
        where(field, operator, value),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      
      const results = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        ...this.convertTimestamps(doc.data())
      }))

      log(`✅ Encontrados ${results.length} documentos com filtro`)
      return results
    } catch (error) {
      console.error(`❌ Erro ao buscar ${collectionName} com filtro:`, error)
      throw error
    }
  }

  // Observar mudanças em tempo real
  onSnapshot(collectionName, callback, orderByField = 'createdAt') {
    try {
      // CORREÇÃO: Para leads, usar dataRegistroContato
      if (collectionName === 'leads') {
        orderByField = 'dataRegistroContato'
      }

      log(`👁️ Configurando listener para ${collectionName}`)
      
      const q = query(
        collection(db, collectionName),
        orderBy(orderByField, 'desc')
      )
      
      return onSnapshot(q, (querySnapshot) => {
        const docs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          ...this.convertTimestamps(doc.data())
        }))
        log(`🔔 Listener ${collectionName}: ${docs.length} documentos`)
        callback(docs)
      }, (error) => {
        console.error(`❌ Erro no listener ${collectionName}:`, error)
      })
    } catch (error) {
      console.error(`❌ Erro ao configurar listener para ${collectionName}:`, error)
      throw error
    }
  }

  // Métodos específicos para relatórios

  // Buscar leads por período
  async getLeadsByPeriod(startDate, endDate) {
    try {
      log(`📅 Buscando leads entre ${startDate} e ${endDate}`)
      
      const start = Timestamp.fromDate(new Date(startDate))
      const end = Timestamp.fromDate(new Date(endDate))
      
      const q = query(
        collection(db, 'leads'),
        where('dataRegistroContato', '>=', start),
        where('dataRegistroContato', '<=', end),
        orderBy('dataRegistroContato', 'desc')
      )
      
      const querySnapshot = await getDocs(q)
      const results = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        ...this.convertTimestamps(doc.data())
      }))

      log(`✅ Encontrados ${results.length} leads no período`)
      return results
    } catch (error) {
      console.error('❌ Erro ao buscar leads por período:', error)
      throw error
    }
  }

  // Calcular taxa de conversão
  async getConversionRate() {
    try {
      console.log('📊 Calculando taxa de conversão')
      
      const leads = await this.getAll('leads')
      const total = leads.length
      const converted = leads.filter(lead => lead.status === 'Convertido').length
      const rate = total > 0 ? (converted / total * 100).toFixed(1) : 0
      
      console.log(`✅ Taxa de conversão: ${rate}% (${converted}/${total})`)
      return rate
    } catch (error) {
      console.error('❌ Erro ao calcular taxa de conversão:', error)
      throw error
    }
  }

  // Obter leads por canal
  async getLeadsByChannel() {
    try {
      console.log('📊 Analisando leads por canal')
      
      const leads = await this.getAll('leads')
      const channels = {}
      leads.forEach(lead => {
        const canal = lead.canalContato || 'Não informado'
        channels[canal] = (channels[canal] || 0) + 1
      })
      
      console.log('✅ Análise por canal concluída:', channels)
      return channels
    } catch (error) {
      console.error('❌ Erro ao buscar leads por canal:', error)
      throw error
    }
  }

  // Obter estatísticas por médico
  async getMedicoStats() {
    try {
      console.log('📊 Calculando estatísticas por médico')
      
      const [leads, medicos] = await Promise.all([
        this.getAll('leads'),
        this.getAll('medicos')
      ])
      
      const stats = {}
      medicos.forEach(medico => {
        const medicoLeads = leads.filter(lead => lead.medicoAgendadoId === medico.id)
        stats[medico.nome] = {
          total_leads: medicoLeads.length,
          agendados: medicoLeads.filter(lead => lead.agendado).length,
          convertidos: medicoLeads.filter(lead => lead.status === 'Convertido').length
        }
      })
      
      console.log('✅ Estatísticas por médico calculadas')
      return stats
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas por médico:', error)
      throw error
    }
  }

  // CORREÇÃO: Utilitário para converter timestamps melhorado
  convertTimestamps(data) {
    const converted = {}
    
    Object.keys(data).forEach(key => {
      const value = data[key]
      if (value && typeof value.toDate === 'function') {
        // É um Timestamp do Firestore
        converted[key] = value.toDate().toISOString()
      } else if (value && value.seconds) {
        // É um Timestamp serializado
        try {
          converted[key] = new Date(value.seconds * 1000).toISOString()
        } catch (e) {
          console.warn(`Erro ao converter timestamp ${key}:`, e)
        }
      }
    })
    
    return converted
  }

  // Inicializar dados padrão (para primeira execução)
  async initializeDefaultData() {
    try {
      console.log('🚀 Verificando se dados padrão precisam ser inicializados')
      
      // Verificar se já existem dados
      const especialidades = await this.getAll('especialidades')
      
      if (especialidades.length === 0) {
        console.log('📦 Criando dados padrão...')
        
        // Criar especialidades padrão
        const defaultEspecialidades = [
          { nome: 'Dermatologia', descricao: 'Cuidados com a pele', ativo: true },
          { nome: 'Cardiologia', descricao: 'Cuidados cardíacos', ativo: true },
          { nome: 'Ortopedia', descricao: 'Cuidados ortopédicos', ativo: true },
          { nome: 'Ginecologia', descricao: 'Saúde da mulher', ativo: true },
          { nome: 'Pediatria', descricao: 'Cuidados infantis', ativo: true }
        ]
        
        for (const esp of defaultEspecialidades) {
          await this.create('especialidades', esp)
        }
        
        console.log('✅ Dados padrão inicializados com sucesso')
      } else {
        console.log('ℹ️ Dados padrão já existem, não é necessário inicializar')
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar dados padrão:', error)
    }
  }
}

export default new FirestoreService()
