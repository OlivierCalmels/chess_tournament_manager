import { createContext } from 'react'
import type { MatchResult, Player, TournamentState } from '../domain/types'

export type TournamentContextValue = {
  state: TournamentState | null
  error: string | null
  lastSyncedAt: string | null
  isSpectator: boolean
  startTournament: (
    players: Player[],
    tournamentName?: string | null,
    maxRounds?: number | null,
  ) => Promise<void>
  setMatchResult: (
    roundIndex: number,
    pairingIndex: number,
    result: MatchResult,
  ) => Promise<void>
  validateRound: () => Promise<void>
  resetTournament: () => void
  importStateJson: (json: string) => void
  /** Charge un tournoi existant depuis le disque (dev) ou le cache local. */
  openTournament: (tournamentId: string) => Promise<boolean>
  /** Supprime le dossier tournoi sur le disque (dev) et vide le cache local si c’était celui-ci. */
  deleteTournament: (tournamentId: string) => Promise<boolean>
}

export const TournamentContext = createContext<TournamentContextValue | null>(
  null,
)
