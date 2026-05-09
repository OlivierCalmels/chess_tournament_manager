import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { tournamentServerPlugin } from './vite/tournamentServerPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), tournamentServerPlugin()],
  base: process.env.VITE_BASE_PATH ?? '/',
  server: {
    open: true,
  },
})
