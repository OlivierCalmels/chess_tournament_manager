import type { Player, RoundState, TournamentState } from './types'

export function computeScores(state: TournamentState): Map<string, number> {
  const scores = new Map<string, number>()
  for (const p of state.players) {
    scores.set(p.id, 0)
  }
  for (const round of state.rounds) {
    if (!round.completed) continue
    for (const pairing of round.pairings) {
      if (pairing.playerBId === null) {
        scores.set(
          pairing.playerAId,
          (scores.get(pairing.playerAId) ?? 0) + 1,
        )
        continue
      }
      if (pairing.result === 'A') {
        scores.set(pairing.playerAId, (scores.get(pairing.playerAId) ?? 0) + 1)
      } else if (pairing.result === 'B') {
        scores.set(pairing.playerBId, (scores.get(pairing.playerBId) ?? 0) + 1)
      } else if (pairing.result === 'draw') {
        scores.set(
          pairing.playerAId,
          (scores.get(pairing.playerAId) ?? 0) + 0.5,
        )
        scores.set(
          pairing.playerBId,
          (scores.get(pairing.playerBId) ?? 0) + 0.5,
        )
      }
    }
  }
  return scores
}

export function playersWithScores(
  state: TournamentState,
): Array<Player & { score: number }> {
  const scores = computeScores(state)
  return state.players.map((p) => ({
    ...p,
    score: scores.get(p.id) ?? 0,
  }))
}

export function hasPlayed(
  a: string,
  b: string,
  rounds: RoundState[],
): boolean {
  for (const r of rounds) {
    for (const p of r.pairings) {
      if (p.playerBId === null) continue
      if (p.result === null) continue
      const x = p.playerAId
      const y = p.playerBId
      if ((x === a && y === b) || (x === b && y === a)) return true
    }
  }
  return false
}

/** Cell for leaderboard: points earned that round, or label for bye / future */
export function roundCellForPlayer(
  round: RoundState | undefined,
  playerId: string,
): string {
  if (!round) return '—'
  const pairing = round.pairings.find(
    (p) =>
      p.playerAId === playerId ||
      (p.playerBId !== null && p.playerBId === playerId),
  )
  if (!pairing) return '—'
  if (pairing.playerBId === null && pairing.playerAId === playerId) {
    return round.completed ? '1 (bye)' : 'bye'
  }
  if (pairing.result === null) return '—'
  const isA = pairing.playerAId === playerId
  if (pairing.result === 'draw') return '½'
  if (pairing.result === 'A') return isA ? '1' : '0'
  if (pairing.result === 'B') return isA ? '0' : '1'
  return '—'
}
