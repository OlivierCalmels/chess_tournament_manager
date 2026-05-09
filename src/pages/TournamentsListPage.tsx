import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  serverGetArchiveBundle,
  serverListTournaments,
  type TournamentListEntry,
} from '../api/tournamentServer'
import { useTournament } from '../context/useTournament'
import type { TournamentState } from '../domain/types'
import {
  buildClientOnlyArchive,
  downloadArchiveBundle,
  type TournamentArchiveV1,
} from '../lib/tournamentArchive'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { PageLayout } from '../ui/PageLayout'

async function resolveArchiveForId(
  tournamentId: string,
  loadedState: TournamentState | null,
): Promise<TournamentArchiveV1 | null> {
  if (import.meta.env.DEV) {
    const fromDisk = await serverGetArchiveBundle(tournamentId)
    if (fromDisk) return fromDisk
  }
  if (loadedState?.tournamentId === tournamentId) {
    return buildClientOnlyArchive(loadedState)
  }
  return null
}

export function TournamentsListPage() {
  const navigate = useNavigate()
  const {
    state,
    isSpectator,
    error,
    resetTournament,
    importStateJson,
    openTournament,
    deleteTournament,
  } = useTournament()
  const [list, setList] = useState<TournamentListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const importRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    if (!import.meta.env.DEV) {
      setList([])
      setLoading(false)
      return
    }
    setLoading(true)
    const rows = await serverListTournaments()
    setList(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh])

  const onDownloadArchive = async (id: string) => {
    const bundle = await resolveArchiveForId(id, state)
    if (!bundle) {
      window.alert('Archive introuvable pour ce tournoi.')
      return
    }
    downloadArchiveBundle(bundle)
  }

  const onDeleteRow = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Supprimer définitivement « ${name} » ? Le dossier data/tournaments/${id} sera effacé.`,
      )
    ) {
      return
    }
    const ok = await deleteTournament(id)
    if (ok) void refresh()
  }

  if (isSpectator) {
    return (
      <PageLayout title="Tournois">
        <Card>
          <p className="text-sm text-zinc-600">
            Non disponible en mode spectateur.
          </p>
        </Card>
      </PageLayout>
    )
  }

  const onNew = () => {
    resetTournament()
    navigate('/setup')
  }

  const onOpen = async (id: string) => {
    const ok = await openTournament(id)
    if (ok) navigate('/tournaments/rounds')
  }

  const onImport = async (f: File | undefined) => {
    if (!f) return
    const text = await f.text()
    importStateJson(text)
    navigate('/tournaments/rounds')
  }

  return (
    <PageLayout title="Tournois">
      {error ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {state ? (
        <Card className="mb-6 border-emerald-200/80 bg-emerald-50/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                Tournoi en cours sur cet appareil
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">
                {state.tournamentName}
              </p>
              <p className="mt-0.5 text-xs text-zinc-600">
                Ronde {state.activeRoundIndex} / {state.maxRounds}
                {state.finished ? ' · terminé' : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void onDownloadArchive(state.tournamentId)}
              >
                Exporter (JSON)
              </Button>
              <Button type="button" onClick={() => navigate('/tournaments/rounds')}>
                Continuer
              </Button>
              {import.meta.env.DEV ? (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() =>
                    void onDeleteRow(state.tournamentId, state.tournamentName)
                  }
                >
                  Supprimer du disque
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Retirer ce tournoi de cet appareil (cache local) ?',
                      )
                    ) {
                      resetTournament()
                    }
                  }}
                >
                  Oublier sur cet appareil
                </Button>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <Button type="button" onClick={onNew}>
          Nouveau tournoi
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void refresh()}
        >
          Rafraîchir la liste
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => importRef.current?.click()}
        >
          Importer JSON (état ou archive)
        </Button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) =>
            void onImport(e.target.files?.[0]).finally(() => {
              e.target.value = ''
            })
          }
        />
      </div>

      <Card title="Tournois sur le disque (dev)">
        {!import.meta.env.DEV ? (
          <p className="text-sm text-zinc-600">
            La liste des dossiers <code className="text-xs">data/tournaments/</code>{' '}
            n&apos;est disponible qu&apos;avec <code className="text-xs">npm run dev</code>.
            Tu peux quand même importer un JSON ou créer un nouveau tournoi.
          </p>
        ) : loading ? (
          <p className="text-sm text-zinc-600">Chargement…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-zinc-600">Aucun tournoi enregistré.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {list.map((t) => {
              const active = state?.tournamentId === t.id
              return (
                <li
                  key={t.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">
                      {t.name}
                      {active ? (
                        <span className="ml-2 text-xs font-normal text-emerald-700">
                          (chargé)
                        </span>
                      ) : null}
                    </p>
                    <p className="font-mono text-xs text-zinc-600">{t.id}</p>
                    {t.updatedAt ? (
                      <p className="text-xs text-zinc-500">
                        MAJ :{' '}
                        {new Date(t.updatedAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant={active ? 'secondary' : 'primary'}
                      onClick={() => void onOpen(t.id)}
                    >
                      Ouvrir
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void onDownloadArchive(t.id)}
                    >
                      Exporter
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => void onDeleteRow(t.id, t.name)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </PageLayout>
  )
}
