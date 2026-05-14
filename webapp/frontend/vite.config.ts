import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Vite builds the Mini App into ../static so FastAPI can serve it
// via StaticFiles(directory="webapp/static", html=True).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../static',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
});
