import { Navigate } from 'react-router-dom'
import { serverGetArchiveBundle } from '../api/tournamentServer'
import { useTournament } from '../context/useTournament'
import {
  computeEliminationStandings,
  eliminationIsLegacyState,
  eliminationRoundColumnLabel,
} from '../domain/eliminationPairing'
import type { LeaderboardRoundCellVariant } from '../domain/scoring'
import { playersWithScores, roundCellMetaForPlayer } from '../domain/scoring'
import type { TournamentFormat } from '../domain/types'
import {
  buildClientOnlyArchive,
  downloadArchiveBundle,
} from '../lib/tournamentArchive'
import {
  buildLeaderboardTsv,
  downloadText,
  leaderboardRoundColumnsCount,
} from '../lib/exportTsv'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EliminationBracketTree } from '../ui/EliminationBracketTree'
import { PageLayout } from '../ui/PageLayout'
import { Table, Td, Th } from '../ui/Table'

function roundCellToneClass(kind: LeaderboardRoundCellVariant): string {
  switch (kind) {
    case 'win':
      return 'inline-block min-w-[1.85rem] rounded-md bg-[#dceee0] px-2 py-0.5 text-center text-xs font-semibold text-[#123524] whitespace-nowrap shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] sm:text-[0.8125rem]'
    case 'loss':
      return 'text-[#7a7068]'
    case 'draw':
      return 'inline-block rounded-md bg-[#f5e8d8] px-1.5 py-0.5 text-center text-xs font-medium text-[#4a3828] whitespace-nowrap sm:text-[0.8125rem]'
    case 'bye':
      return 'italic text-[#7d5f3a] text-xs whitespace-nowrap sm:text-[0.8125rem]'
    case 'pending':
      return 'text-[#a89888]'
    default:
      return ''
  }
}

export function LeaderboardPage() {
  const { state, isSpectator } = useTournament()

  if (isSpectator && !state) {
    return (
      <PageLayout surface="salon" title="Classement">
        <p className="text-sm text-[#5c4d42]">
          Agrégation des parties…
        </p>
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
  const nRoundCols = leaderboardRoundColumnsCount(state)
  const scoresById = new Map(
    playersWithScores(state).map((ps) => [ps.id, ps] as const),
  )

  type DisplayRow = { id: string; name: string; score: number; place: number }

  const rows: DisplayRow[] =
    format === 'elimination' && !legacyElim ?
      computeEliminationStandings(state).map((sr) => {
        const pl = state.players.find((x) => x.id === sr.playerId)!
        const sc = scoresById.get(sr.playerId)?.score ?? 0
        return {
          id: sr.playerId,
          name: pl.name,
          score: sc,
          place: sr.rank,
        }
      })
    : playersWithScores(state)
        .sort((a, b) => b.score - a.score || b.elo - a.elo)
        .map((p, i) => ({
          id: p.id,
          name: p.name,
          score: p.score,
          place: i + 1,
        }))

  const exportTsv = () => {
    const tsv = buildLeaderboardTsv(state)
    downloadText(
      `leaderboard-${state.tournamentId}.tsv`,
      tsv,
      'text/tab-separated-values;charset=utf-8',
    )
  }

  const exportJson = () => {
    downloadText(
      `tournament-${state.tournamentId}.json`,
      JSON.stringify(state, null, 2),
      'application/json;charset=utf-8',
    )
  }

  const exportFullArchive = async () => {
    let bundle =
      import.meta.env.DEV ?
        await serverGetArchiveBundle(state.tournamentId)
      : null
    if (!bundle) bundle = buildClientOnlyArchive(state)
    downloadArchiveBundle(bundle)
  }

  return (
    <PageLayout
      surface="salon"
      title={`Classement — ${state.tournamentName}`}
    >
      {!isSpectator ?
        <div className="salon-muted mb-6 flex flex-col gap-2 rounded-xl p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <p className="text-xs leading-snug text-[#484038]">
            Exports réservés à l&apos;organisation.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="salon" onClick={exportTsv}>
              Télécharger TSV
            </Button>
            <Button type="button" variant="salon" onClick={exportJson}>
              JSON sauvegarde
            </Button>
            <Button type="button" variant="salon" onClick={() => void exportFullArchive()}>
              Archive complète
            </Button>
          </div>
        </div>
      : null}

      <p className="mb-8 font-display text-sm font-medium italic text-[#4a392a]">
        Tableau général · points et rondes
      </p>

      {format === 'elimination' ?
        <EliminationBracketTree state={state} visualTone="salon" />
      : null}
      {legacyElim ?
        <p className="mb-4 rounded-lg border border-[#d4b896]/60 bg-[#faf3e9] px-3 py-2.5 text-sm text-[#5c3f24]">
          Ce fichier provient de l&apos;ancien mode élimination (sans tableau
          coupe). Le classement aux points peut différer d&apos;une coupe ; la
          validation des rondes est désactivée.
        </p>
      : null}

      {/* Pleine largeur écran sur mobile (le main a max-w + px-4). */}
      <div className="relative left-1/2 w-[100vw] max-w-[100vw] -translate-x-1/2 px-4 sm:relative sm:left-0 sm:w-full sm:max-w-none sm:translate-x-0 sm:px-0">
        <Card tone="salon">
          <h2 className="font-display mb-3 text-[1.05rem] font-semibold text-[#2e2218] sm:text-xl">
            Scores au fil des rondes
          </h2>
          <Table
            className={[
              'salon-score-table',
              '[&_table]:w-full [&_table]:text-xs [&_table]:tabular-nums sm:[&_table]:text-sm',
              '[&_th]:px-2 [&_th]:py-1.5 sm:[&_th]:px-3 sm:[&_th]:py-2',
              '[&_td]:px-2 [&_td]:py-1.5 sm:[&_td]:px-3 sm:[&_td]:py-2',
            ].join(' ')}
          >
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Joueur</Th>
                <Th>
                  {format === 'elimination' && !legacyElim ?
                    'Victoires'
                  : 'Score'}
                </Th>
                {Array.from({ length: nRoundCols }, (_, i) => (
                  <Th key={i} className="whitespace-nowrap">
                    {format === 'elimination'
                      ? eliminationRoundColumnLabel(i + 1, state.maxRounds)
                      : `R${i + 1}`}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  data-salon-place={p.place <= 3 ? p.place : undefined}
                >
                  <Td className="font-medium tabular-nums">{p.place}</Td>
                  <Td
                    className={
                      p.place <= 3 ?
                        'max-w-[11rem] font-semibold text-[#1f1812] sm:max-w-none'
                      : 'max-w-[11rem] font-medium text-[#2e241d] sm:max-w-none'
                    }
                  >
                    <span className="line-clamp-2 sm:line-clamp-none">
                      {p.name}
                    </span>
                  </Td>
                  <Td
                    className={
                      p.place <= 3 ?
                        'font-semibold tabular-nums text-[#1f1812]'
                      : ''
                    }
                  >
                    {p.score}
                  </Td>
                  {Array.from({ length: nRoundCols }, (_, i) => {
                    const round = state.rounds.find(
                      (r) => r.roundIndex === i + 1,
                    )
                    const meta = roundCellMetaForPlayer(round, p.id, format)
                    return (
                      <Td key={i} className="text-center sm:text-left">
                        <span className={roundCellToneClass(meta.variant)}>
                          {meta.text}
                        </span>
                      </Td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </PageLayout>
  )
}
