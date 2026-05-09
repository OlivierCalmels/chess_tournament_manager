/**
 * Onglets ouverts par `npm run dev:sync` : Actions CI, spectateur Pages, puis orga local.
 */
import { execFileSync } from 'node:child_process'

const EXTERNAL_URLS = [
  'https://github.com/OlivierCalmels/chess_tournament_manager/actions',
  'https://oliviercalmels.github.io/chess_tournament_manager/tournaments/leaderboard',
]

const LOCAL_ORGANIZER_URL = 'http://localhost:5173/'
/** Latence après le début du script : laisser Vite orga binder le port avant le GET. */
const DELAY_BEFORE_LOCAL_MS = 2_500

function openUrl(url) {
  const { platform } = process
  if (platform === 'darwin') {
    execFileSync('open', [url], { stdio: 'ignore' })
  } else if (platform === 'win32') {
    execFileSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' })
  } else {
    execFileSync('xdg-open', [url], { stdio: 'ignore' })
  }
}

for (const u of EXTERNAL_URLS) openUrl(u)
await new Promise((r) => setTimeout(r, DELAY_BEFORE_LOCAL_MS))
openUrl(LOCAL_ORGANIZER_URL)
