import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
          pdf: ['pdfjs-dist']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  preview: {
    port: 4173
  },
  optimizeDeps: {
    include: ['pdfjs-dist/build/pdf', 'pdfjs-dist/build/pdf.worker.entry']
  }
})
