import type { TournamentState } from '../domain/types'
import { playersWithScores, roundCellForPlayer } from '../domain/scoring'

export function buildLeaderboardTsv(state: TournamentState): string {
  const rows = playersWithScores(state).sort((a, b) => b.score - a.score)
  const roundCols = Array.from({ length: state.maxRounds }, (_, i) => `R${i + 1}`)
  const header = ['Nom', 'Score', ...roundCols].join('\t')
  const lines = [header]
  for (const p of rows) {
    const r = [p.name, String(p.score)]
    for (let i = 1; i <= state.maxRounds; i++) {
      const round = state.rounds.find((rr) => rr.roundIndex === i)
      r.push(roundCellForPlayer(round, p.id))
    }
    lines.push(r.join('\t'))
  }
  return lines.join('\n')
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
