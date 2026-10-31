import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function showcasePlugin(): Plugin {
  return {
    name: 'serve-showcase-html',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/showcase' || req.url === '/showcase/') {
          req.url = '/showcase/index.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), showcasePlugin()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8787' } },
});
