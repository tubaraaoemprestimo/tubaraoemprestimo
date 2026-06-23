import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  process.env.GOMAXPROCS ||= '1';
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // Demo mode: troca apiClient pelo mock em build-time.
        // VITE_DEMO_MODE=true → toda chamada de rede vai para o mockApiClient.
        ...(env.VITE_DEMO_MODE === 'true' && {
          './apiClient': path.resolve(__dirname, 'services/mockApiClient.ts'),
          '../apiClient': path.resolve(__dirname, 'services/mockApiClient.ts'),
        }),
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      // ponytail: esbuild minify estoura memória no Windows; reativar após dividir bundle pesado/html2pdf.
      minify: false,
      commonjsOptions: {
        include: [/html2pdf/, /node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            icons: ['lucide-react']
          }
        }
      }
    }
  };
});
// Force Vercel deploy 1773866248
