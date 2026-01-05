// Configuração do Firebase
import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'

// Configuração do Firebase - SUBSTITUA PELOS SEUS DADOS
const firebaseConfig = {
  apiKey: "AIzaSyAkKgL2C1AEEBkD29QV0BhkDqbfCRoxzDs",
  authDomain: "younv-gaspar.firebaseapp.com",
  projectId: "younv-gaspar",
  storageBucket: "younv-gaspar.firebasestorage.app",
  messagingSenderId: "1062334247343",
  appId: "1:1062334247343:web:b8bce9995ad7faa96fbf5a",
  measurementId: "G-7EZHDVN2KZ"
}

// Para desenvolvimento local, você pode usar o emulador
// Descomente as linhas abaixo se quiser usar o emulador local
const USE_EMULATOR = false

// Inicializar Firebase
const app = initializeApp(firebaseConfig)

// Inicializar Firestore
export const db = getFirestore(app)

// Inicializar Authentication
export const auth = getAuth(app)

// Conectar aos emuladores em desenvolvimento (opcional)
if (USE_EMULATOR && process.env.NODE_ENV === 'development') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080)
    connectAuthEmulator(auth, 'http://localhost:9099')
  } catch (error) {
    console.log('Emuladores já conectados ou não disponíveis')
  }
}

export default app

