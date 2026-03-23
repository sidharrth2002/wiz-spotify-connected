import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/rooms': 'http://localhost:8888',
      '/dance-to-system-audio': 'http://localhost:8888',
      '/dance-to-system-audio/abort': 'http://localhost:8888',
      '/dance-to-system-audio/mode': 'http://localhost:8888',
      '/layout': 'http://localhost:8888',
      '/color-theme': 'http://localhost:8888'
    }
  },
  build: {
    outDir: 'dist'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
