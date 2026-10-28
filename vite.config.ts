import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // O Even Hub carrega o index.html de dentro do pacote: caminhos relativos
  // evitam depender da origem do WebView.
  base: './',
  build: {
    target: 'es2022',
    cssTarget: 'chrome111',
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: true,
    port: 5173,
  },
})
