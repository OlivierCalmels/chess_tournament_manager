import {
  computeEliminationStandings,
  eliminationRoundColumnLabel,
  eliminationIsLegacyState,
} from '../domain/eliminationPairing'
import type { TournamentFormat, TournamentState } from '../domain/types'
import { playersWithScores, roundCellForPlayer } from '../domain/scoring'

export function leaderboardRoundColumnsCount(state: TournamentState): number {
  return Math.max(
    state.maxRounds,
    0,
    ...state.rounds.map((r) => r.roundIndex),
  )
}

export function buildLeaderboardTsv(state: TournamentState): string {
  const format: TournamentFormat = state.format ?? 'swiss'
  const nCols = leaderboardRoundColumnsCount(state)

  type Row = {
    playerId: string
    name: string
    score: number
    rank?: number
  }

  const rows: Row[] =
    format === 'elimination' && !eliminationIsLegacyState(state) ?
      (() => {
        const standings = computeEliminationStandings(state)
        const byId = new Map(state.players.map((x) => [x.id, x]))
        const scoreMap = new Map(
          playersWithScores(state).map((x) => [x.id, x.score]),
        )
        return standings.map((s) => {
          const pl = byId.get(s.playerId)!
          return {
            playerId: s.playerId,
            name: pl.name,
            score: scoreMap.get(s.playerId) ?? 0,
            rank: s.rank,
          }
        })
      })()
    : playersWithScores(state)
        .sort((a, b) => b.score - a.score || b.elo - a.elo)
        .map((p) => ({
          playerId: p.id,
          name: p.name,
          score: p.score,
        }))

  const roundCols =
    format === 'elimination' ?
      Array.from({ length: nCols }, (_, i) =>
        eliminationRoundColumnLabel(i + 1, state.maxRounds),
      )
    : Array.from({ length: nCols }, (_, i) => `R${i + 1}`)

  const header =
    format === 'elimination' && !eliminationIsLegacyState(state) ?
      ['Place', 'Nom', ...roundCols, 'Parties gagnées'].join('\t')
    : ['Nom', 'Score', ...roundCols].join('\t')
  const lines = [header]
  for (const p of rows) {
    const r =
      format === 'elimination' && !eliminationIsLegacyState(state)
        ? [String(p.rank ?? ''), p.name]
      : [p.name, String(p.score)]
    for (let i = 1; i <= nCols; i++) {
      const round = state.rounds.find((rr) => rr.roundIndex === i)
      r.push(roundCellForPlayer(round, p.playerId, format))
    }
    if (format === 'elimination' && !eliminationIsLegacyState(state)) {
      r.push(String(p.score))
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
