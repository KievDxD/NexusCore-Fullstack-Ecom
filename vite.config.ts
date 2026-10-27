import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 600,
    // Sin sourcemaps en producción
    sourcemap: false,
    target: 'es2020',
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Hash en los nombres de archivo para cache-busting automático.
        // Se eliminó `manualChunks`: el matching por substring ('react') capturaba también
        // react-router, lucide-react, etc. y producía chunks mal repartidos. Las rutas ya se
        // dividen con React.lazy y el bundler resuelve el resto correctamente.
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
