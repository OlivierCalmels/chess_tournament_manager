import { Navigate } from 'react-router-dom'
import { serverGetArchiveBundle } from '../api/tournamentServer'
import { useTournament } from '../context/useTournament'
import {
  computeEliminationStandings,
  eliminationIsLegacyState,
  eliminationRoundColumnLabel,
} from '../domain/eliminationPairing'
import { playersWithScores, roundCellForPlayer } from '../domain/scoring'
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

export function LeaderboardPage() {
  const { state, isSpectator } = useTournament()

  if (isSpectator && !state) {
    return (
      <PageLayout title="Classement">
        <p className="text-sm text-zinc-600">Chargement…</p>
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
    <PageLayout title={`Classement — ${state.tournamentName}`}>
      {!isSpectator ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={exportTsv}>
            Télécharger TSV
          </Button>
          <Button type="button" variant="secondary" onClick={exportJson}>
            Télécharger JSON (sauvegarde)
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void exportFullArchive()}
          >
            Exporter (archive JSON)
          </Button>
        </div>
      ) : null}
      {format === 'elimination' ?
        <EliminationBracketTree state={state} />
      : null}
      {legacyElim ?
        <p className="mb-4 text-sm text-amber-900">
          Ce fichier provient de l&apos;ancien mode élimination (sans tableau
          coupe). Le classement aux points peut différer d&apos;une coupe ; la
          validation des rondes est désactivée.
        </p>
      : null}
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Place</Th>
              <Th>Nom</Th>
              <Th>
                {format === 'elimination' && !legacyElim ?
                  'Victoires'
                : 'Score'}
              </Th>
              {Array.from({ length: nRoundCols }, (_, i) => (
                <Th key={i}>
                  {format === 'elimination'
                    ? eliminationRoundColumnLabel(i + 1, state.maxRounds)
                    : `R${i + 1}`}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <Td>{p.place}</Td>
                <Td className="font-medium">{p.name}</Td>
                <Td>{p.score}</Td>
                {Array.from({ length: nRoundCols }, (_, i) => {
                  const round = state.rounds.find(
                    (r) => r.roundIndex === i + 1,
                  )
                  return (
                    <Td key={i}>
                      {roundCellForPlayer(round, p.id, format)}
                    </Td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </PageLayout>
  )
}
