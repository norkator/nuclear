/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { pages, consolePaths } from './site/pages.mjs';
import { renderPage } from './site/render.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'static-search-content',
      transformIndexHtml: {
        order: 'pre',
        handler: (html, context) => renderPage(html, context.path),
      },
    },
  ],
  build: {
    rolldownOptions: {
      input: [...pages.map(page => page.path), ...consolePaths].map(path => fileURLToPath(new URL(`.${path}index.html`, import.meta.url))),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/session': { target: 'http://127.0.0.1:8081', ws: true },
    },
  },
});
