import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ESPER-machine/',
  server: {
    port: 3000,
    host: true
  },
  build: {
    target: 'esnext'
  }
});
