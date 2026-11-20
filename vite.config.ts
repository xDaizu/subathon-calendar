/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/subathon-calendar/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        overlay: resolve(import.meta.dirname, 'overlay.html'),
        unlocks: resolve(import.meta.dirname, 'unlocks.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
  test: {
    environment: 'node',
  },
});
