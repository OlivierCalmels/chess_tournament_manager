import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { tournamentServerPlugin } from './vite/tournamentServerPlugin'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  /** Pour le middleware tournoi (Node) — ex. `ENABLE_TOURNAMENT_GIT_SYNC` dans `.env.local`. */
  const fromFiles = loadEnv(mode, process.cwd(), '')
  for (const key of Object.keys(fromFiles)) {
    if (process.env[key] === undefined) process.env[key] = fromFiles[key]
  }

  return {
    plugins: [react(), tailwindcss(), tournamentServerPlugin()],
    base: process.env.VITE_BASE_PATH ?? '/',
    server: {
      open: true,
    },
  }
})
