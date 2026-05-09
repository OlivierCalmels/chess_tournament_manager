export const SCHEMA_VERSION = 3 as const

/** Ancienne élimination (vagues vainqueurs/perdants sans arbre coupe). */
export const ELIMINATION_SCHEMA_LEGACY = 2 as const

/**
 * Coupe à élimination directe type Wikipédia + petite finale + tableaux de classement.
 * Présent sur chaque partie (élimination) à partir du schéma 3.
 */
export type EliminationPairingMeta = {
  kind: 'main' | 'bronze' | 'placement'
  /** Clé stable du match dans le plan (ex. main-1-0, bronze-0, pl-m0-r0-s0). */
  key: string
  /** Coupe principale : 0 = 1re ronde tableau, jusqu’à (log2(B)-1) = finale. */
  mainDepth?: number
  mainSlot?: number
  /** Perdants issus du main à cette profondeur (pour placement). */
  cohortMainDepth?: number
  /** Profondeur dans le mini-bracket placement (0 = 1re ronde locale). */
  placementDepth?: number
  placementSlot?: number
  /** Sous-arbre duplication placement : vainqueurs (W) ou perdants (L) à ce niveau. */
  placementLane?: 'W' | 'L'
  /** Connexion graphe tableau : ids `elim.key` des matchs donneurs (ou null). */
  connectFrom?: [string | null, string | null]
}

/** Nombre de rondes autorisé au lancement (inclus). */
export const MIN_ROUNDS = 1
export const MAX_ROUNDS_CAP = 8
export const DEFAULT_MAX_ROUNDS = 4

export const BYE_POINTS = 1 as const

export type TournamentFormat = 'swiss' | 'elimination'

/** Premier tour élimination : ELO (fort-faible) ou ordre aléatoire figé à la création. */
export type EliminationFirstRound = 'elo' | 'random'

export type MatchResult = 'A' | 'B' | 'draw' | null

export type TieBreakResult = 'A' | 'B' | null

export type Pairing = {
  playerAId: string
  playerBId: string | null
  result: MatchResult
  /**
   * Élimination : après une nulle, vainqueur de la partie de départage (5 min, couleurs inversées).
   * Suisse : ignoré.
   */
  tieBreakResult?: TieBreakResult
  /** Coupe : métadonnées (schéma ≥ 3, moteur Wikipédia). */
  elim?: EliminationPairingMeta
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
  schemaVersion: number
  tournamentId: string
  /** Libellé affiché ; par défaut jour + heure à la création. */
  tournamentName: string
  createdAt: string
  /** Suisse : choisi au lancement. Élimination : dérivé du nombre de joueurs. */
  maxRounds: number
  /** Défaut `swiss` pour JSON anciens. */
  format?: TournamentFormat
  /** Significatif si format === 'elimination'. */
  elimFirstRound?: EliminationFirstRound
  /**
   * Ordre des joueurs (ids) pour le premier tour en élimination ; figé à la création.
   * Toujours défini en élimination (ELO = tri ELO, random = permutation).
   */
  eliminationRound1Order?: string[]
  /**
   * true si tournoi chargé depuis l’ancien format élimination (pas de champ `elim` sur les paires).
   * Consultation uniquement ; valider une ronde impossible.
   */
  eliminationLegacy?: boolean
  players: Player[]
  rounds: RoundState[]
  /** 1-based index of the round currently being played (or last completed + next) */
  activeRoundIndex: number
  finished: boolean
}

export type PublicLivePayload = TournamentState & {
  updatedAt?: string
}
