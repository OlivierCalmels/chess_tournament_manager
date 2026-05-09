import { buildRoundPairings } from './pairing'
import {
  DEFAULT_MAX_ROUNDS,
  MAX_ROUNDS_CAP,
  MIN_ROUNDS,
  SCHEMA_VERSION,
  type Player,
  type TournamentState,
} from './types'

export function generatePlayerId(): string {
  return crypto.randomUUID()
}

export function createTournamentId(): string {
  const part = Math.random().toString(36).slice(2, 8)
  return `t-${Date.now()}-${part}`
}

/** Nom affiché par défaut : jour et heure (locale fr). */
export function defaultTournamentName(at: Date = new Date()): string {
  return at.toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Assure `tournamentName` pour les états importés / anciens JSON. */
export function ensureTournamentName(state: TournamentState): TournamentState {
  if (state.tournamentName?.trim()) return state
  return {
    ...state,
    tournamentName: defaultTournamentName(new Date(state.createdAt)),
  }
}

function clampMaxRounds(n: unknown): number {
  const v =
    typeof n === 'number' && !Number.isNaN(n)
      ? Math.floor(n)
      : DEFAULT_MAX_ROUNDS
  return Math.min(MAX_ROUNDS_CAP, Math.max(MIN_ROUNDS, v))
}

/** Nom + nombre de rondes pour états legacy / import JSON. */
export function normalizeTournamentState(state: TournamentState): TournamentState {
  const named = ensureTournamentName(state)
  const maxRounds = clampMaxRounds(named.maxRounds)
  return { ...named, maxRounds }
}

export function initialTournamentState(
  players: Player[],
  nameOverride?: string | null,
  maxRoundsOverride?: number | null,
): TournamentState {
  const tournamentId = createTournamentId()
  const now = new Date()
  const createdAt = now.toISOString()
  const trimmed = nameOverride?.trim()
  const tournamentName = trimmed || defaultTournamentName(now)
  const maxRounds = clampMaxRounds(
    maxRoundsOverride ?? DEFAULT_MAX_ROUNDS,
  )
  const base: TournamentState = {
    schemaVersion: SCHEMA_VERSION,
    tournamentId,
    tournamentName,
    maxRounds,
    createdAt,
    players,
    rounds: [],
    activeRoundIndex: 1,
    finished: false,
  }
  const pairings = buildRoundPairings(base, 1)
  base.rounds = [
    {
      roundIndex: 1,
      pairings,
      completed: false,
    },
  ]
  return base
}

export function rosterSnapshotPayload(
  state: TournamentState,
): Record<string, unknown> {
  return {
    tournamentId: state.tournamentId,
    tournamentName: state.tournamentName,
    maxRounds: state.maxRounds,
    createdAt: state.createdAt,
    players: state.players.map((p) => ({ id: p.id, name: p.name, elo: p.elo })),
  }
}

export function canValidateRound(state: TournamentState): boolean {
  const round = state.rounds.find((r) => r.roundIndex === state.activeRoundIndex)
  if (!round || round.completed) return false
  return round.pairings.every((p) => {
    if (p.playerBId === null) return p.result === 'A'
    return p.result !== null
  })
}

export function maxRoundReached(state: TournamentState): boolean {
  return state.rounds.filter((r) => r.completed).length >= state.maxRounds
}
