import { normalizeTournamentState } from '../domain/tournamentFactory'
import type { TournamentState } from '../domain/types'
import { downloadText } from './exportTsv'

export type TournamentArchiveV1 = {
  exportFormat: 'chess-tournament-archive-v1'
  exportedAt: string
  tournamentId: string
  config: unknown
  state: unknown
  eventsNdjson: string
  snapshots: Record<string, unknown>
  note?: string
}

export function isTournamentArchiveV1(
  value: unknown,
): value is TournamentArchiveV1 {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  if (o.exportFormat !== 'chess-tournament-archive-v1') return false
  if (typeof o.tournamentId !== 'string' || !o.tournamentId.trim()) {
    return false
  }
  if (!o.state || typeof o.state !== 'object' || Array.isArray(o.state)) {
    return false
  }
  return true
}

/**
 * Accepte soit un `TournamentState` seul, soit une archive v1 (on prend `state`).
 */
export function parseImportedTournamentJson(
  json: string,
): TournamentState | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (isTournamentArchiveV1(parsed)) {
    const inner = parsed.state as Partial<TournamentState>
    if (
      !inner?.tournamentId ||
      !Array.isArray(inner.players) ||
      inner.players.length === 0
    ) {
      return null
    }
    return normalizeTournamentState(inner as TournamentState)
  }
  const st = parsed as Partial<TournamentState>
  if (
    !st?.tournamentId ||
    !Array.isArray(st.players) ||
    st.players.length === 0
  ) {
    return null
  }
  return normalizeTournamentState(st as TournamentState)
}

export function buildClientOnlyArchive(
  state: TournamentState,
): TournamentArchiveV1 {
  return {
    exportFormat: 'chess-tournament-archive-v1',
    exportedAt: new Date().toISOString(),
    tournamentId: state.tournamentId,
    config: null,
    state,
    eventsNdjson: '',
    snapshots: {},
    note: 'Export local (état courant uniquement — pas de journal sur disque).',
  }
}

export function archiveFilename(tournamentId: string) {
  return `tournament-archive-${tournamentId}.json`
}

export function downloadArchiveBundle(bundle: TournamentArchiveV1) {
  const json = JSON.stringify(bundle, null, 2)
  downloadText(
    archiveFilename(bundle.tournamentId),
    json,
    'application/json;charset=utf-8',
  )
}
