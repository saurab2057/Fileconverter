import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  // Your existing server block is fine.
  server: {
    // ...
  },

  // --- START: ADD THIS BLOCK TO REMOVE COMMENTS FROM PRODUCTION BUILD ---
  build: {
    minify: 'terser',
    terserOptions: {
      format: {
        comments: false, // This is the crucial line that removes all comments
      },
    },
  },
  // --- END: ADD THIS BLOCK ---
})