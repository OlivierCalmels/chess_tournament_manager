import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTournament } from '../context/useTournament'
import {
  bracketSize,
  eliminationIsLegacyState,
  eliminationMatchTitleFr,
  eliminationPhaseLabelFr,
} from '../domain/eliminationPairing'
import { canValidateRound } from '../domain/tournamentFactory'
import { opponentsMap } from '../domain/pairing'
import { playersWithScores } from '../domain/scoring'
import type { MatchResult, TournamentFormat } from '../domain/types'
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
    setTieBreakResult,
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

  const format: TournamentFormat = state.format ?? 'swiss'
  const legacyElim =
    format === 'elimination' && eliminationIsLegacyState(state)
  const bm = bracketSize(state.players.length)
  const maxMainDepth = Math.max(0, Math.round(Math.log2(bm)) - 1)

  const formatLabel =
    format === 'elimination' ?
      legacyElim ?
        'Élimination (ancien mode, lecture seule)'
      : 'Élimination directe (coupe + classement)'
    : 'Suisse'

  const round = state.rounds.find(
    (r) => r.roundIndex === state.activeRoundIndex,
  )

  const nameOf = (id: string) =>
    state.players.find((p) => p.id === id)?.name ?? id

  const currentPhaseLabel =
    format === 'elimination' && round ?
      eliminationPhaseLabelFr(round.roundIndex, state.maxRounds)
    : null

  return (
    <PageLayout title={state.tournamentName}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-600">
          <span className="text-zinc-500">{formatLabel}</span>
          {' · '}
          Ronde <strong>{state.activeRoundIndex}</strong> /{' '}
          {state.maxRounds}
          {currentPhaseLabel ?
            <>
              {' · '}
              <span className="font-medium text-zinc-800">{currentPhaseLabel}</span>
            </>
          : null}
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

      {leaders.length > 0 && format === 'swiss' ? (
        <p className="mb-4 text-sm text-amber-800">
          Leader{leaders.length > 1 ? 's' : ''} :{' '}
          {leaders.map((l) => l.name).join(', ')} ({leaders[0]?.score} pts)
        </p>
      ) : null}

      {format === 'elimination' && !legacyElim ?
        <Card title="Déroulement (coupe à élimination directe)" className="mb-6">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-800">
            {Array.from({ length: state.maxRounds }, (_, i) => {
              const ri = i + 1
              const rSlot = state.rounds.find((rr) => rr.roundIndex === ri)
              const phase = eliminationPhaseLabelFr(ri, state.maxRounds)
              const completed = Boolean(rSlot?.completed)
              const isActive =
                ri === state.activeRoundIndex && !completed && !state.finished
              return (
                <li
                  key={ri}
                  className={
                    isActive ? 'font-semibold text-zinc-900'
                    : completed ? 'text-zinc-600'
                    : 'text-zinc-500'
                  }
                >
                  <span className="text-zinc-900">{phase}</span>
                  {' — '}
                  <span className="text-xs font-normal text-zinc-500">
                    Vague {ri}
                    {completed ? ' · terminée' : isActive ? ' · en cours' : ''}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            Tableau principal (type Wikipédia) : vainqueurs seulement
            remontent vers la finale. Après les demi-finales : finale + match pour la
            3ᵉ place. Les perdants sont classés dans des mini-tableaux
            (places 5–N).
          </p>
        </Card>
      : null}
      {legacyElim ?
        <p className="mb-6 text-sm text-amber-900">
          Tournoi enregistré avec l&apos;ancien système sans tableau coupe ; les
          rondes suivantes ne peuvent plus être validées ici.
        </p>
      : null}

      <Card
        title={
          format === 'elimination' && round ?
            `Matchs — vague ${round.roundIndex} (${eliminationPhaseLabelFr(round.roundIndex, state.maxRounds)})`
          : 'Matchs'
        }
      >
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
                    {pair.elim ?
                      <span className="mb-1 block text-xs font-normal uppercase tracking-wide text-zinc-500">
                        {eliminationMatchTitleFr(pair.elim, maxMainDepth)}
                      </span>
                    : null}
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
                            ? pair.tieBreakResult === 'A'
                              ? `Nulle — TB : ${nameOf(pair.playerAId)}`
                              : pair.tieBreakResult === 'B'
                                ? `Nulle — TB : ${nameOf(pair.playerBId)}`
                                : 'Nulle (TB ?)'
                            : '—'}
                    </span>
                  ) : (
                    <div className="flex w-full flex-col gap-2 sm:w-72">
                      <div>
                        <Label htmlFor={`res-${idx}`}>Résultat (partie)</Label>
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
                          <option value="A">
                            {nameOf(pair.playerAId)} gagne
                          </option>
                          <option value="B">
                            {nameOf(pair.playerBId)} gagne
                          </option>
                          <option value="draw">Nulle</option>
                        </Select>
                      </div>
                      {format === 'elimination' &&
                      pair.result === 'draw' &&
                      pair.playerBId ? (
                        <div>
                          <Label htmlFor={`tb-${idx}`}>
                            Départage 5 min (couleurs inversées)
                          </Label>
                          <Select
                            id={`tb-${idx}`}
                            value={pair.tieBreakResult ?? ''}
                            disabled={round.completed || state.finished}
                            onChange={(e) => {
                              const v = e.target.value
                              if (v !== 'A' && v !== 'B') return
                              void setTieBreakResult(
                                round.roundIndex,
                                idx,
                                v,
                              )
                            }}
                            className="mt-1"
                          >
                            <option value="">— Vainqueur du départage —</option>
                            <option value="A">
                              {nameOf(pair.playerAId)} gagne le départage
                            </option>
                            <option value="B">
                              {nameOf(pair.playerBId)} gagne le départage
                            </option>
                          </Select>
                        </div>
                      ) : null}
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
