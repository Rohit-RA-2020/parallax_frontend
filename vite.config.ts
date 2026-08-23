import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Mermaid ships one generated parser module that cannot be divided by a
    // bundler. It is behind the chat diagram dynamic import (143 kB gzip),
    // while all eagerly loaded application chunks remain below 200 kB.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?react(?:-dom)?[\\/]/,
              priority: 30,
            },
            {
              name: 'motion-vendor',
              test: /node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(?:framer-motion|motion-dom|motion-utils)[\\/]/,
              priority: 25,
            },
            {
              name: 'three-vendor',
              test: /node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?three[\\/]/,
              maxSize: 350_000,
              priority: 20,
            },
            {
              name: 'editor-vendor',
              test: /node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(?:@radix-ui|@floating-ui|dompurify|lucide-react|marked|tus-js-client|zustand)[\\/]/,
              maxSize: 350_000,
              priority: 15,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
