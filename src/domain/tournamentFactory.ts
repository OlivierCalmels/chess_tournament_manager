import {
  buildEliminationRoundOnePairings,
  eliminationIsLegacyState,
  eliminationMaxRounds,
} from './eliminationPairing'
import { buildRoundPairings } from './pairing'
import { pairingIsResolved } from './scoring'
import {
  DEFAULT_MAX_ROUNDS,
  MAX_ROUNDS_CAP,
  MIN_ROUNDS,
  SCHEMA_VERSION,
  type EliminationFirstRound,
  type Player,
  type TournamentFormat,
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

function shufflePlayerIds(
  ids: string[],
  random: () => number = Math.random,
): string[] {
  const a = [...ids]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Nom + schéma + nombre de rondes pour états legacy / import JSON. */
export function normalizeTournamentState(state: TournamentState): TournamentState {
  const named = ensureTournamentName(state)
  const format: TournamentFormat = named.format ?? 'swiss'
  const nPlayers = named.players.length
  const maxRounds =
    format === 'elimination'
      ? eliminationMaxRounds(nPlayers)
      : clampMaxRounds(named.maxRounds)

  let eliminationRound1Order = named.eliminationRound1Order
  if (
    format === 'elimination' &&
    (!eliminationRound1Order || eliminationRound1Order.length !== nPlayers)
  ) {
    eliminationRound1Order = [...named.players]
      .sort((a, b) => b.elo - a.elo)
      .map((p) => p.id)
  }

  let eliminationLegacy = named.eliminationLegacy === true
  if (
    format === 'elimination' &&
    !eliminationLegacy &&
    named.rounds.some((r) =>
      r.pairings.some(
        (p) => p.elim === undefined && (p.playerBId === null || p.playerBId),
      ),
    )
  ) {
    eliminationLegacy = true
  }

  return {
    ...named,
    schemaVersion: SCHEMA_VERSION,
    format,
    maxRounds,
    elimFirstRound: named.elimFirstRound ?? 'elo',
    eliminationRound1Order,
    ...(format === 'elimination' ? { eliminationLegacy } : {}),
  }
}

export type InitialTournamentOptions = {
  format?: TournamentFormat
  elimFirstRound?: EliminationFirstRound
}

export function initialTournamentState(
  players: Player[],
  nameOverride?: string | null,
  maxRoundsOverride?: number | null,
  options?: InitialTournamentOptions | null,
): TournamentState {
  const tournamentId = createTournamentId()
  const now = new Date()
  const createdAt = now.toISOString()
  const trimmed = nameOverride?.trim()
  const tournamentName = trimmed || defaultTournamentName(now)
  const format: TournamentFormat = options?.format ?? 'swiss'
  const elimFirstRound: EliminationFirstRound =
    options?.elimFirstRound ?? 'elo'

  const n = players.length
  const maxRounds =
    format === 'elimination'
      ? eliminationMaxRounds(n)
      : clampMaxRounds(maxRoundsOverride ?? DEFAULT_MAX_ROUNDS)

  let eliminationRound1Order: string[] | undefined
  if (format === 'elimination') {
    const ids = players.map((p) => p.id)
    eliminationRound1Order =
      elimFirstRound === 'random'
        ? shufflePlayerIds(ids)
        : [...players].sort((a, b) => b.elo - a.elo).map((p) => p.id)
  }

  const base: TournamentState = {
    schemaVersion: SCHEMA_VERSION,
    tournamentId,
    tournamentName,
    maxRounds,
    format,
    ...(format === 'elimination' ? { elimFirstRound, eliminationRound1Order } : {}),
    createdAt,
    players,
    rounds: [],
    activeRoundIndex: 1,
    finished: false,
  }

  const pairings =
    format === 'elimination'
      ? buildEliminationRoundOnePairings(base)
      : buildRoundPairings(base, 1)

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
  const format = state.format ?? 'swiss'
  return {
    tournamentId: state.tournamentId,
    tournamentName: state.tournamentName,
    maxRounds: state.maxRounds,
    /** Persisté dans config.json (dev) avec playerCount et liste players. */
    format,
    playerCount: state.players.length,
    elimFirstRound: state.elimFirstRound,
    eliminationRound1Order: state.eliminationRound1Order,
    createdAt: state.createdAt,
    players: state.players.map((p) => ({ id: p.id, name: p.name, elo: p.elo })),
  }
}

export function canValidateRound(state: TournamentState): boolean {
  if (
    (state.format ?? 'swiss') === 'elimination' &&
    eliminationIsLegacyState(state)
  ) {
    return false
  }
  const round = state.rounds.find((r) => r.roundIndex === state.activeRoundIndex)
  if (!round || round.completed) return false
  const format: TournamentFormat = state.format ?? 'swiss'
  return round.pairings.every((p) => pairingIsResolved(p, format))
}

export function maxRoundReached(state: TournamentState): boolean {
  return state.rounds.filter((r) => r.completed).length >= state.maxRounds
}
