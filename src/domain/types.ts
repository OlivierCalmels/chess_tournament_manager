export const SCHEMA_VERSION = 1 as const

/** Nombre de rondes autorisé au lancement (inclus). */
export const MIN_ROUNDS = 1
export const MAX_ROUNDS_CAP = 8
export const DEFAULT_MAX_ROUNDS = 4

export const BYE_POINTS = 1 as const

export type MatchResult = 'A' | 'B' | 'draw' | null

export type Pairing = {
  playerAId: string
  playerBId: string | null
  result: MatchResult
}

export type RoundState = {
  roundIndex: number
  pairings: Pairing[]
  completed: boolean
}

export type Player = {
  id: string
  name: string
  elo: number
}

export type TournamentState = {
  schemaVersion: typeof SCHEMA_VERSION
  tournamentId: string
  /** Libellé affiché ; par défaut jour + heure à la création. */
  tournamentName: string
  createdAt: string
  /** Nombre de rondes prévues (choisi au lancement). */
  maxRounds: number
  players: Player[]
  rounds: RoundState[]
  /** 1-based index of the round currently being played (or last completed + next) */
  activeRoundIndex: number
  finished: boolean
}

export type PublicLivePayload = TournamentState & {
  updatedAt?: string
}
