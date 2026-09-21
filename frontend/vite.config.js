import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true }), // Opens bundle analysis after build
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    // Local development proxy:
    // Forwards frontend /api/* requests to the local Express backend.
    // This allows API_BASE_URL to remain empty, matching the production
    // same-origin setup used by Vercel's /api rewrite.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    minify: 'terser',

    terserOptions: {
      format: {
        comments: false, // Removes all comments from production JS
      },
    },
  },
});