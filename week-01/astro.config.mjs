import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // checkOrigin disabled: src/middleware.js implements equivalent CSRF protection
  // with proper x-forwarded-proto handling for reverse-proxy deployments.
  security: {
    checkOrigin: false,
  },
  vite: {
    ssr: {
      external: ['better-sqlite3'],
    },
  },
});
