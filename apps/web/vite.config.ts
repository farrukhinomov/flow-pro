import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// The dev server forwards API paths to the API so the browser talks to one origin, as it does
// behind the production reverse proxy. The Host header is kept (Vite's string shorthand would
// rewrite it), so the API's same-origin check sees the page's own origin, exactly as in
// production. The session e2e run points the target at its own API.
const apiProxy = {
  target: process.env.FLOWPRO_API_PROXY_TARGET ?? 'http://127.0.0.1:5123',
  changeOrigin: false,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': apiProxy,
      '/openapi': apiProxy,
      '/scalar': apiProxy,
    },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              priority: 40,
              test: /node_modules[\\/](react|react-dom)[\\/]/,
            },
            {
              name: 'tanstack-vendor',
              priority: 35,
              test: /node_modules[\\/]@tanstack[\\/]/,
            },
            {
              name: 'radix-vendor',
              priority: 30,
              test: /node_modules[\\/]@radix-ui[\\/]/,
            },
            {
              name: 'ui-vendor',
              priority: 25,
              test: /node_modules[\\/](lucide-react|cmdk|input-otp|sonner|react-top-loading-bar)[\\/]/,
            },
            {
              name: 'forms-vendor',
              priority: 20,
              test: /node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/,
            },
            {
              name: 'utils-vendor',
              priority: 15,
              test: /node_modules[\\/](date-fns|axios|class-variance-authority|clsx|tailwind-merge|zustand)[\\/]/,
            },
          ],
          minSize: 20_000,
        },
      },
    },
  },
})
