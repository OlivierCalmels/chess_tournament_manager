import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTournament } from '../context/useTournament'
import { canValidateRound } from '../domain/tournamentFactory'
import { opponentsMap } from '../domain/pairing'
import { playersWithScores } from '../domain/scoring'
import type { MatchResult } from '../domain/types'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { PageLayout } from '../ui/PageLayout'
import { Select } from '../ui/Select'
import { Label } from '../ui/Label'

export function TournamentPage() {
  const {
    state,
    isSpectator,
    setMatchResult,
    validateRound,
    resetTournament,
    lastSyncedAt,
  } = useTournament()
  const [showOpp, setShowOpp] = useState(false)

  const leaders = useMemo(() => {
    if (!state) return []
    const rows = playersWithScores(state)
    const max = Math.max(...rows.map((r) => r.score), 0)
    return rows.filter((r) => r.score === max && max > 0)
  }, [state])

  const opp = useMemo(() => (state ? opponentsMap(state) : null), [state])

  if (isSpectator && !state) {
    return (
      <PageLayout title="Tournoi">
        <p className="text-sm text-zinc-600">Chargement du tournoi…</p>
      </PageLayout>
    )
  }

  if (!isSpectator && !state) {
    return <Navigate to="/tournaments" replace />
  }

  if (!state) return null

  const round = state.rounds.find(
    (r) => r.roundIndex === state.activeRoundIndex,
  )

  const nameOf = (id: string) =>
    state.players.find((p) => p.id === id)?.name ?? id

  return (
    <PageLayout title={state.tournamentName}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-600">
          Ronde <strong>{state.activeRoundIndex}</strong> /{' '}
          {state.maxRounds}
          {state.finished ? (
            <span className="ml-2 text-emerald-700">— terminé</span>
          ) : null}
        </p>
        {lastSyncedAt ? (
          <p className="text-xs text-zinc-500">
            Dernière synchro : {new Date(lastSyncedAt).toLocaleTimeString()}
          </p>
        ) : null}
      </div>

      {leaders.length > 0 ? (
        <p className="mb-4 text-sm text-amber-800">
          Leader{leaders.length > 1 ? 's' : ''} :{' '}
          {leaders.map((l) => l.name).join(', ')} ({leaders[0]?.score} pts)
        </p>
      ) : null}

      <Card title="Matchs">
        {!round ? (
          <p className="text-sm text-zinc-600">Aucune ronde en cours.</p>
        ) : (
          <ul className="space-y-4">
            {round.pairings.map((pair, idx) => (
              <li
                key={idx}
                className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 sm:p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium text-zinc-900">
                    {pair.playerBId === null ? (
                      <span>
                        {nameOf(pair.playerAId)}{' '}
                        <span className="text-zinc-500">(bye)</span>
                      </span>
                    ) : (
                      <span>
                        {nameOf(pair.playerAId)}{' '}
                        <span className="text-zinc-500">vs</span>{' '}
                        {nameOf(pair.playerBId)}
                      </span>
                    )}
                  </div>
                  {pair.playerBId === null ? null : isSpectator ? (
                    <span className="text-sm text-zinc-600">
                      {pair.result === 'A'
                        ? `${nameOf(pair.playerAId)} gagne`
                        : pair.result === 'B'
                          ? `${nameOf(pair.playerBId)} gagne`
                          : pair.result === 'draw'
                            ? 'Nulle'
                            : '—'}
                    </span>
                  ) : (
                    <div className="sm:w-64">
                      <Label htmlFor={`res-${idx}`}>Résultat</Label>
                      <Select
                        id={`res-${idx}`}
                        value={pair.result ?? ''}
                        disabled={round.completed || state.finished}
                        onChange={(e) => {
                          const v = e.target.value as MatchResult | ''
                          void setMatchResult(
                            round.roundIndex,
                            idx,
                            v === '' ? null : v,
                          )
                        }}
                      >
                        <option value="">—</option>
                        <option value="A">{nameOf(pair.playerAId)} gagne</option>
                        <option value="B">{nameOf(pair.playerBId)} gagne</option>
                        <option value="draw">Nulle</option>
                      </Select>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!isSpectator ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => void validateRound()}
            disabled={
              !round ||
              round.completed ||
              state.finished ||
              !canValidateRound(state)
            }
          >
            Valider la ronde
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (
                window.confirm(
                  'Réinitialiser tout le tournoi sur cet appareil ?',
                )
              ) {
                resetTournament()
              }
            }}
          >
            Reset tournoi
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowOpp((v) => !v)}
          >
            {showOpp ? 'Masquer' : 'Voir'} adversaires passés
          </Button>
        </div>
      ) : null}

      {showOpp && opp ? (
        <Card title="Adversaires (debug appariement)" className="mt-6">
          <ul className="space-y-2 text-sm">
            {state.players.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> :{' '}
                {(opp.get(p.id) ?? []).map((id) => nameOf(id)).join(', ') ||
                  '—'}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </PageLayout>
  )
}
