// Configuração do Firebase
import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'

// Configuração do Firebase - SUBSTITUA PELOS SEUS DADOS
const firebaseConfig = {
  apiKey: "AIzaSyDR7AYovFmWAc_Slm8XawQtQ9jn7IrJo-0",
  authDomain: "younv-bebe.firebaseapp.com",
  projectId: "younv-bebe",
  storageBucket: "younv-bebe.firebasestorage.app",
  messagingSenderId: "715445917279",
  appId: "1:715445917279:web:1ee27c4e6fbbffb0ea6dea",
  measurementId: "G-04FRWHL2H0"
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

