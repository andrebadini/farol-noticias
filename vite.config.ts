import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { bundleHygiene } from './scripts/bundle-hygiene.mjs'

export default defineConfig({
  plugins: [bundleHygiene(), react()],
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
