// Vite-Konfiguration für SchulAdmin Frontend

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@schuladmin/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      // Windows + Docker: Dateiänderungen sonst oft nicht erkannt
      usePolling: true,
      interval: 1000,
    },
    // Proxy für API-Anfragen im Entwicklungsmodus
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
