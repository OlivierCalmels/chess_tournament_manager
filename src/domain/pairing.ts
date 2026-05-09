import type { Player, Pairing, RoundState, TournamentState } from './types'
import { computeScores, hasPlayed, pairingIsResolved } from './scoring'

function pairHighLow(orderedByStrength: Player[]): Pairing[] {
  const n = orderedByStrength.length
  const ids = orderedByStrength.map((p) => p.id)
  if (n % 2 === 1) {
    const byeId = ids[n - 1]
    const rest = orderedByStrength.slice(0, n - 1)
    const pairs = pairHighLowEven(rest.map((p) => p.id))
    pairs.push({ playerAId: byeId, playerBId: null, result: 'A' })
    return pairs
  }
  return pairHighLowEven(ids)
}

function pairHighLowEven(ids: string[]): Pairing[] {
  const n = ids.length
  const out: Pairing[] = []
  for (let i = 0; i < n / 2; i++) {
    out.push({
      playerAId: ids[i],
      playerBId: ids[n - 1 - i],
      result: null,
    })
  }
  return out
}

function tryConsecutivePairings(
  sortedIds: string[],
  completedRounds: RoundState[],
): Pairing[] | null {
  if (sortedIds.length % 2 === 1) return null
  const pairs: Pairing[] = []
  for (let i = 0; i < sortedIds.length; i += 2) {
    const a = sortedIds[i]
    const b = sortedIds[i + 1]
    if (hasPlayed(a, b, completedRounds)) return null
    pairs.push({ playerAId: a, playerBId: b, result: null })
  }
  return pairs
}

/** Heuristic: bubble swaps to avoid rematches while keeping score order roughly stable */
function pairConsecutiveWithRematchAvoidance(
  sortedPlayers: Player[],
  completedRounds: RoundState[],
): Pairing[] {
  const n = sortedPlayers.length
  const ids = sortedPlayers.map((p) => p.id)

  if (n % 2 === 1) {
    const byeId = ids[n - 1]
    const rest = sortedPlayers.slice(0, n - 1)
    const inner = pairConsecutiveWithRematchAvoidance(rest, completedRounds)
    return [...inner, { playerAId: byeId, playerBId: null, result: 'A' }]
  }

  const arr = [...ids]
  const maxIter = 200
  for (let iter = 0; iter < maxIter; iter++) {
    const ok = tryConsecutivePairings(arr, completedRounds)
    if (ok) return ok
    let swapped = false
    for (let i = 0; i < arr.length; i += 2) {
      const a = arr[i]
      const b = arr[i + 1]
      if (!hasPlayed(a, b, completedRounds)) continue
      if (i + 2 < arr.length) {
        ;[arr[i + 1], arr[i + 2]] = [arr[i + 2], arr[i + 1]]
        swapped = true
        break
      }
      if (i >= 2) {
        ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
        swapped = true
        break
      }
    }
    if (!swapped) break
  }

  const fallback: Pairing[] = []
  for (let i = 0; i < arr.length; i += 2) {
    fallback.push({
      playerAId: arr[i],
      playerBId: arr[i + 1],
      result: null,
    })
  }
  return fallback
}

export function buildRoundPairings(
  state: TournamentState,
  roundIndex: number,
): Pairing[] {
  const completed = state.rounds.filter((r) => r.completed)

  if (roundIndex === 1) {
    const byElo = [...state.players].sort((a, b) => b.elo - a.elo)
    return pairHighLow(byElo)
  }

  const scores = computeScores(state)
  const byScore = [...state.players].sort((a, b) => {
    const sa = scores.get(a.id) ?? 0
    const sb = scores.get(b.id) ?? 0
    if (sb !== sa) return sb - sa
    return b.elo - a.elo
  })

  return pairConsecutiveWithRematchAvoidance(byScore, completed)
}

export function opponentsMap(state: TournamentState): Map<string, string[]> {
  const format = state.format ?? 'swiss'
  const m = new Map<string, string[]>()
  for (const p of state.players) {
    m.set(p.id, [])
  }
  for (const r of state.rounds) {
    for (const pair of r.pairings) {
      if (pair.playerBId === null || !pairingIsResolved(pair, format)) continue
      const a = pair.playerAId
      const b = pair.playerBId
      m.get(a)?.push(b)
      m.get(b)?.push(a)
    }
  }
  return m
}
