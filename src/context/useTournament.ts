import { useContext } from 'react'
import { TournamentContext } from './tournamentContext'

export function useTournament() {
  const ctx = useContext(TournamentContext)
  if (!ctx) {
    throw new Error('useTournament must be used within TournamentProvider')
  }
  return ctx
}
