import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import { tournamentServerPlugin } from './vite/tournamentServerPlugin'

/**
 * GitHub Pages renvoie 404 pour les chemins virtuels (/repo/tournaments/...).
 * Une copie de `index.html` en `404.html` permet au bundle SPA de charger
 * puis à React Router d’aligner la vue sur `location.pathname`.
 * @see https://github.com/rafgraph/spa-github-pages
 */
function spaGithubPagesFallback(): Plugin {
  return {
    name: 'spa-github-pages-404-fallback',
    closeBundle() {
      const dist = path.resolve(process.cwd(), 'dist')
      const indexHtml = path.join(dist, 'index.html')
      const fallback = path.join(dist, '404.html')
      if (fs.existsSync(indexHtml))
        fs.copyFileSync(indexHtml, fallback)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  /** Pour le middleware tournoi (Node) — ex. `ENABLE_TOURNAMENT_GIT_SYNC` dans `.env.local`. */
  const fromFiles = loadEnv(mode, process.cwd(), '')
  for (const key of Object.keys(fromFiles)) {
    if (process.env[key] === undefined) process.env[key] = fromFiles[key]
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      tournamentServerPlugin(),
      /** Uniquement lors de `vite build` (hook `closeBundle`). */
      spaGithubPagesFallback(),
    ],
    base: process.env.VITE_BASE_PATH ?? '/',
    server: {
      open: true,
    },
  }
})
