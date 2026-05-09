import { Navigate } from 'react-router-dom'
import { serverGetArchiveBundle } from '../api/tournamentServer'
import { useTournament } from '../context/useTournament'
import { playersWithScores, roundCellForPlayer } from '../domain/scoring'
import {
  buildClientOnlyArchive,
  downloadArchiveBundle,
} from '../lib/tournamentArchive'
import { buildLeaderboardTsv, downloadText } from '../lib/exportTsv'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
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

  const rows = playersWithScores(state).sort((a, b) => b.score - a.score)

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
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Nom</Th>
              <Th>Score</Th>
              {Array.from({ length: state.maxRounds }, (_, i) => (
                <Th key={i}>R{i + 1}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, rank) => (
              <tr key={p.id}>
                <Td>{rank + 1}</Td>
                <Td className="font-medium">{p.name}</Td>
                <Td>{p.score}</Td>
                {Array.from({ length: state.maxRounds }, (_, i) => {
                  const round = state.rounds.find(
                    (r) => r.roundIndex === i + 1,
                  )
                  return (
                    <Td key={i}>{roundCellForPlayer(round, p.id)}</Td>
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
