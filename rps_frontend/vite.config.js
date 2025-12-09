import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    host: true,
    strictPort: true,
    hmr: {
      clientPort: 5173,
      protocol: 'ws',
      host: 'localhost',
    },
    // Force HTTP/1.1 to prevent Chrome HTTP/2 conflicts
    https: false,
    cors: true,
    // Disable proxy to avoid conflicts with direct connections
    // proxy: {
    //   '/api': {
    //     target: 'http://localhost:8000',
    //     changeOrigin: true,
    //     secure: false,
    //     rewrite: (path) => path.replace(/^\/api/, '')
    //   },
    //   '/ws': {
    //     target: 'ws://localhost:8000',
    //     ws: true,
    //     changeOrigin: true
    //   }
    // }
  },
  // SPA fallback configuration
  build: {
    rollupOptions: {
      input: '/index.html'
    },
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  define: {
    'process.env': {}
  },
  // Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
    css: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    }
  }
});
