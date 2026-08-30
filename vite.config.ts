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
              // Three.js has classes that extend types from neighboring
              // modules. Splitting the package by size can turn those module
              // relationships into circular chunks with undefined bases.
              name: 'three-vendor',
              test: /node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?three[\\/]/,
              priority: 20,
            },
            {
              // Keep this group intact. Radix's remove-scroll packages contain
              // module-level initialization cycles that break when maxSize
              // divides the group into mutually importing chunks.
              name: 'editor-vendor',
              test: /node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(?:@radix-ui|@floating-ui|dompurify|lucide-react|marked|tus-js-client|zustand)[\\/]/,
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
		proxy: {
			'/v1': { target: 'http://127.0.0.1:8080', changeOrigin: true },
			'/health': { target: 'http://127.0.0.1:8080', changeOrigin: true },
		},
  },
})
