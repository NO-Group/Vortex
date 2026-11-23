import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dashboard is served behind arbitrary preview hosts (and localhost),
// so the dev server accepts any Host header and proxies all engine traffic
// server-side — the browser never talks to localhost directly.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: false,
        xfwd: true,
        ws: true,
      },
      '/apps': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: false,
        xfwd: true,
      },
      '/functions': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: false,
        xfwd: true,
      },
      '/healthz': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: false,
        xfwd: true,
      },
    },
  },
});
