#!/usr/bin/env node
/**
 * Push manuel des dossiers data/ (alternative à ENABLE_TOURNAMENT_GIT_SYNC pendant le dev).
 * À lancer depuis la racine du repo : npm run tournament:push
 */
import { execFileSync } from 'node:child_process'

const cwd = process.cwd()

execFileSync(
  'git',
  ['add', 'data/tournaments', 'data/public/live.json'],
  { cwd, stdio: 'inherit' },
)

try {
  execFileSync('git', ['diff', '--staged', '--quiet'], { cwd, stdio: 'ignore' })
  console.log('Rien de nouveau à committer.')
  process.exit(0)
} catch {
  execFileSync(
    'git',
    ['commit', '-m', 'tournament: push manuel données'],
    { cwd, stdio: 'inherit' },
  )
}

execFileSync('git', ['push'], { cwd, stdio: 'inherit' })
