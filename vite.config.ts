import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // Tamaño máximo antes de advertir (en kB)
    chunkSizeWarningLimit: 600,
    // Genera sourcemaps solo en dev, no en producción
    sourcemap: false,
    // Minificación agresiva con esbuild (más rápido que terser)
    minify: 'esbuild',
    // Target moderno para bundles más pequeños
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react') || id.includes('scheduler')) {
              return 'react-vendor';
            }
            if (id.includes('react-router') || id.includes('react-router-dom')) {
              return 'router';
            }
            if (id.includes('@supabase') || id.includes('websocket')) {
              return 'supabase';
            }
            if (id.includes('lucide-react') || id.includes('sonner') || id.includes('framer-motion')) {
              return 'ui-vendor';
            }
            if (id.includes('zustand')) {
              return 'state';
            }
            return 'vendor';
          }
        },
      },
    },
  },
  // Optimizar dependencias que Vite debe pre-bundlear
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js', 'zustand', 'lucide-react', 'sonner'],
  },
})
