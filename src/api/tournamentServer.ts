import type { TournamentArchiveV1 } from '../lib/tournamentArchive'
import type { TournamentState } from '../domain/types'

const isDev = import.meta.env.DEV

async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  if (!isDev) {
    return { ok: false, error: 'api_only_in_dev' }
  }
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    const text = await res.text()
    let data: T | undefined
    try {
      data = text ? (JSON.parse(text) as T) : undefined
    } catch {
      data = undefined
    }
    if (!res.ok) {
      return {
        ok: false,
        error: (data as { error?: string })?.error ?? `http_${res.status}`,
      }
    }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function serverInit(body: {
  tournamentId: string
  meta: unknown
  state: TournamentState
  rosterSnapshot: unknown
  rosterSha256: string
}) {
  return api<{ ok: boolean }>('/api/tournament/init', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

type PersistPayload = {
  state: TournamentState
  event?: Record<string, unknown>
  triggerGit?: boolean
}

/** Persistance disque (dev) — PUT /api/tournament/:id/persist */
export async function serverPersist(tournamentId: string, body: PersistPayload) {
  return api<{ ok: boolean }>(`/api/tournament/${tournamentId}/persist`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** Alias POST optionnel — même corps que serverPersist. */
export async function serverSave(tournamentId: string, body: PersistPayload) {
  return api<{ ok: boolean }>(`/api/tournament/${tournamentId}/save`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function serverGetState(
  tournamentId: string,
): Promise<TournamentState | null> {
  const r = await api<TournamentState>(
    `/api/tournament/${tournamentId}/state`,
    { method: 'GET' },
  )
  if (!r.ok || !r.data) return null
  return r.data
}

/** Archive complète (config, state, journal NDJSON, snapshots). */
export async function serverGetArchiveBundle(
  tournamentId: string,
): Promise<TournamentArchiveV1 | null> {
  const r = await api<TournamentArchiveV1>(
    `/api/tournament/${tournamentId}/archive`,
    { method: 'GET' },
  )
  if (!r.ok || !r.data) return null
  if (r.data.exportFormat !== 'chess-tournament-archive-v1') return null
  return r.data
}

export async function serverDeleteTournament(tournamentId: string) {
  return api<{ ok: boolean }>(`/api/tournament/${tournamentId}`, {
    method: 'DELETE',
  })
}

export type TournamentListEntry = {
  id: string
  name: string
  updatedAt: string | null
}

export async function serverListTournaments(): Promise<
  TournamentListEntry[]
> {
  const r = await api<{ tournaments: TournamentListEntry[] }>(
    '/api/tournament/list',
    { method: 'GET' },
  )
  if (!r.ok || !r.data?.tournaments) return []
  return r.data.tournaments
}

export async function fetchPublicState(
  url: string,
): Promise<TournamentState | null> {
  try {
    const sep = url.includes('?') ? '&' : '?'
    const res = await fetch(`${url}${sep}t=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<TournamentState> & {
      tournamentId?: string
      players?: unknown[]
    }
    if (
      !data?.tournamentId ||
      !Array.isArray(data.players) ||
      data.players.length === 0
    ) {
      return null
    }
    return data as TournamentState
  } catch {
    return null
  }
}
