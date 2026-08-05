import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Backend de desarrollo. Cambiar con BACKEND_URL en frontend/.env.local
  // si el 8000 está ocupado (p.ej. BACKEND_URL=http://localhost:8001).
  const backend = env.BACKEND_URL || 'http://localhost:8000';
  const proxy = { target: backend, changeOrigin: true };
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        // El frontend llama a /mcnails/api/... (ver src/api/*.ts), por eso
        // el prefijo /mcnails debe proxearse, no solo /api.
        '/mcnails': proxy,
        '/api': proxy,
        '/media': proxy,
      },
    },
  };
});
