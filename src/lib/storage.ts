import type { TournamentState } from '../domain/types'

export const LS_KEY = 'chess-tournament-manager-v1'

export type LocalPersistShape = {
  tournamentId: string
  state: TournamentState
}

export function loadLocal(): LocalPersistShape | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as LocalPersistShape
    if (!v?.state?.tournamentId) return null
    return v
  } catch {
    return null
  }
}

export function saveLocal(data: LocalPersistShape) {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

export function clearLocal() {
  localStorage.removeItem(LS_KEY)
}
