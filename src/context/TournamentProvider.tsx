import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchPublicState,
  serverDeleteTournament,
  serverGetState,
  serverInit,
  serverPersist,
} from '../api/tournamentServer'
import {
  isSpectatorMode,
  PUBLIC_POLL_INTERVAL_MS,
  PUBLIC_STATE_URL,
} from '../config'
import { buildRoundPairings } from '../domain/pairing'
import {
  canValidateRound,
  initialTournamentState,
  normalizeTournamentState,
  rosterSnapshotPayload,
} from '../domain/tournamentFactory'
import type { MatchResult, Player, TournamentState } from '../domain/types'
import { parseImportedTournamentJson } from '../lib/tournamentArchive'
import { hashRosterPayload } from '../lib/rosterHash'
import { clearLocal, loadLocal, saveLocal } from '../lib/storage'
import { TournamentContext } from './tournamentContext'

function cloneState(s: TournamentState): TournamentState {
  return structuredClone(s)
}

function initialClientState(): TournamentState | null {
  if (isSpectatorMode) return null
  const raw = loadLocal()?.state
  if (!raw) return null
  return normalizeTournamentState(raw)
}

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TournamentState | null>(initialClientState)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const persist = useCallback(
    async (
      next: TournamentState,
      event?: Record<string, unknown>,
      triggerGit?: boolean,
    ) => {
      saveLocal({ tournamentId: next.tournamentId, state: next })
      if (import.meta.env.DEV) {
        const r = await serverPersist(next.tournamentId, {
          state: next,
          event,
          triggerGit: Boolean(triggerGit),
        })
        if (!r.ok) {
          setError(r.error ?? 'persist_failed')
        } else {
          setError(null)
        }
      }
      setLastSyncedAt(new Date().toISOString())
    },
    [],
  )

  useEffect(() => {
    const publicUrl = PUBLIC_STATE_URL
    if (isSpectatorMode && publicUrl) {
      const tick = async () => {
        const remote = await fetchPublicState(publicUrl)
        if (remote?.tournamentId) {
          setState(normalizeTournamentState(remote))
          setLastSyncedAt(new Date().toISOString())
          setError(null)
        } else {
          setState(null)
          setLastSyncedAt(null)
        }
      }
      void tick()
      pollRef.current = setInterval(tick, PUBLIC_POLL_INTERVAL_MS)
      const onVis = () => {
        if (document.visibilityState === 'visible') void tick()
      }
      document.addEventListener('visibilitychange', onVis)
      return () => {
        if (pollRef.current) clearInterval(pollRef.current)
        document.removeEventListener('visibilitychange', onVis)
      }
    }

    if (!isSpectatorMode && import.meta.env.DEV) {
      const local = loadLocal()
      if (local?.state) {
        void (async () => {
          const remote = await serverGetState(local.tournamentId)
          if (remote) {
            const normalized = normalizeTournamentState(remote)
            setState(normalized)
            saveLocal({
              tournamentId: normalized.tournamentId,
              state: normalized,
            })
          }
        })()
      }
    }
    return undefined
  }, [])

  const startTournament = useCallback(
    async (
      players: Player[],
      tournamentName?: string | null,
      maxRounds?: number | null,
    ) => {
      setError(null)
      const next = initialTournamentState(players, tournamentName, maxRounds)
      const rosterSnap = rosterSnapshotPayload(next)
      const rosterJson = JSON.stringify(rosterSnap)
      const rosterSha256 = await hashRosterPayload(rosterJson)

      if (import.meta.env.DEV) {
        const init = await serverInit({
          tournamentId: next.tournamentId,
          meta: rosterSnap,
          state: next,
          rosterSnapshot: rosterSnap,
          rosterSha256,
        })
        if (!init.ok) {
          setError(
            init.error === 'exists'
              ? 'Dossier tournoi déjà présent sur le disque ; poursuite en local. Supprimez data/tournaments/<id> pour resynchroniser.'
              : (init.error ?? 'init_failed'),
          )
        } else {
          setError(null)
        }
      }

      setState(next)
      saveLocal({ tournamentId: next.tournamentId, state: next })
      setLastSyncedAt(new Date().toISOString())
    },
    [],
  )

  const setMatchResult = useCallback(
    async (roundIndex: number, pairingIndex: number, result: MatchResult) => {
      if (!state || isSpectatorMode) return
      const next = cloneState(state)
      const round = next.rounds.find((r) => r.roundIndex === roundIndex)
      if (!round || round.completed) return
      const pairing = round.pairings[pairingIndex]
      if (!pairing) return
      pairing.result = result
      setState(next)
      await persist(next, {
        type: 'RESULT_SET',
        roundIndex,
        pairingIndex,
        result,
      }, true)
    },
    [persist, state],
  )

  const validateRound = useCallback(async () => {
    if (!state || isSpectatorMode) return
    if (!canValidateRound(state)) return

    const next = cloneState(state)
    const idx = next.rounds.findIndex(
      (r) => r.roundIndex === next.activeRoundIndex,
    )
    if (idx === -1) return
    next.rounds[idx] = { ...next.rounds[idx], completed: true }

    const completedCount = next.rounds.filter((r) => r.completed).length
    if (completedCount >= next.maxRounds) {
      next.finished = true
      setState(next)
      await persist(next, {
        type: 'ROUND_VALIDATED',
        roundIndex: next.activeRoundIndex,
        finished: true,
      }, false)
      return
    }

    const newRoundIndex = next.activeRoundIndex + 1
    const pairings = buildRoundPairings(
      { ...next, activeRoundIndex: newRoundIndex },
      newRoundIndex,
    )
    next.rounds.push({
      roundIndex: newRoundIndex,
      pairings,
      completed: false,
    })
    next.activeRoundIndex = newRoundIndex
    setState(next)
    await persist(next, {
      type: 'ROUND_VALIDATED',
      roundIndex: next.activeRoundIndex - 1,
      nextRound: newRoundIndex,
    }, false)
  }, [persist, state])

  const resetTournament = useCallback(() => {
    clearLocal()
    setState(null)
    setError(null)
    setLastSyncedAt(null)
  }, [])

  const importStateJson = useCallback((json: string) => {
    const normalized = parseImportedTournamentJson(json)
    if (!normalized) {
      setError('import_invalid')
      return
    }
    setState(normalized)
    saveLocal({
      tournamentId: normalized.tournamentId,
      state: normalized,
    })
    setError(null)
  }, [])

  const deleteTournament = useCallback(
    async (tournamentId: string) => {
      if (isSpectatorMode) return false
      if (import.meta.env.DEV) {
        const r = await serverDeleteTournament(tournamentId)
        if (!r.ok && r.error !== 'not_found') {
          setError(r.error ?? 'suppression_impossible')
          return false
        }
      } else if (state?.tournamentId !== tournamentId) {
        return false
      }
      if (state?.tournamentId === tournamentId) {
        clearLocal()
        setState(null)
        setLastSyncedAt(null)
      }
      setError(null)
      return true
    },
    [state],
  )

  const openTournament = useCallback(async (tournamentId: string) => {
    if (isSpectatorMode) return false
    setError(null)
    let next: TournamentState | null = null
    if (import.meta.env.DEV) {
      next = await serverGetState(tournamentId)
    }
    if (!next) {
      const local = loadLocal()
      if (local?.tournamentId === tournamentId) {
        next = local.state
      }
    }
    if (!next) {
      setError('charge_tournoi_impossible')
      return false
    }
    const normalized = normalizeTournamentState(next)
    setState(normalized)
    saveLocal({
      tournamentId: normalized.tournamentId,
      state: normalized,
    })
    setLastSyncedAt(new Date().toISOString())
    setError(null)
    return true
  }, [])

  const value = useMemo(
    () => ({
      state,
      error,
      lastSyncedAt,
      isSpectator: isSpectatorMode,
      startTournament,
      setMatchResult,
      validateRound,
      resetTournament,
      importStateJson,
      openTournament,
      deleteTournament,
    }),
    [
      state,
      error,
      lastSyncedAt,
      startTournament,
      setMatchResult,
      validateRound,
      resetTournament,
      importStateJson,
      openTournament,
      deleteTournament,
    ],
  )

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  )
}
