import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.ico', 'icons/apple-touch-icon-180x180.png', 'icons/icon.svg'],
      manifest: {
        name: 'Gan Israel Beth Hillel',
        short_name: 'Gan Israel',
        description: 'CRM Inscriptions Centre Aéré',
        theme_color: '#1e3a8a',
        background_color: '#1e3a8a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/admin',
        icons: [
          { src: 'icons/pwa-64x64.png',             sizes: '64x64',     type: 'image/png' },
          { src: 'icons/pwa-192x192.png',            sizes: '192x192',   type: 'image/png' },
          { src: 'icons/pwa-512x512.png',            sizes: '512x512',   type: 'image/png' },
          { src: 'icons/maskable-icon-512x512.png',  sizes: '512x512',   type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: null,
      },
    }),
  ],
  server: {
    allowedHosts: true,
    proxy: {
      '/api': `http://localhost:${process.env.API_PORT || 3001}`,
    },
  },
})
