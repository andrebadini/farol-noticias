import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter-tight'
import '@fontsource/instrument-serif'
import '@fontsource/instrument-serif/400-italic.css'
import './index.css'
import App from './App'

// StrictMode desligado de propósito: o SDK dos óculos abre a página de startup
// uma única vez e efeitos duplicados em dev criariam duas páginas concorrentes.
createRoot(document.getElementById('root')!).render(<App />)
