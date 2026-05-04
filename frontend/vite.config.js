import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true }),   // Opens bundle analysis after build
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    // your existing server options (keep as is)
  },

  build: {
    minify: 'terser',
    terserOptions: {
      format: {
        comments: false,   // Removes all comments from production JS
      },
    },
  },
})