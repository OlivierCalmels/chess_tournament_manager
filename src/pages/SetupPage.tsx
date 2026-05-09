import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTournament } from '../context/useTournament'
import {
  PRESET_PLAYERS,
  duplicatePlayerNameMessage,
  isPresetUsedOnOtherRow,
  matchPresetIndex,
  rowsFromPresets,
  type PresetRow,
} from '../data/presetPlayers'
import { eliminationMaxRounds } from '../domain/eliminationPairing'
import {
  defaultTournamentName,
  generatePlayerId,
} from '../domain/tournamentFactory'
import {
  DEFAULT_MAX_ROUNDS,
  MAX_ROUNDS_CAP,
  MIN_ROUNDS,
  type Player,
  type TournamentFormat,
} from '../domain/types'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { PageLayout } from '../ui/PageLayout'
import { Select } from '../ui/Select'

const MIN_P = 4
const MAX_P = 10

/** Nombre de parties à deux joueurs par ronde (échiquiers). */
function matchsParRonde(nombreJoueurs: number): number {
  return Math.floor(nombreJoueurs / 2)
}

/** Nombre total de parties à deux sur tout le tournoi. */
function matchsAuTotal(nombreJoueurs: number, nombreRondes: number): number {
  return nombreRondes * matchsParRonde(nombreJoueurs)
}

export function SetupPage() {
  const navigate = useNavigate()
  const { state, startTournament, isSpectator, importStateJson, error } =
    useTournament()
  const [rows, setRows] = useState<PresetRow[]>(() => rowsFromPresets(8))
  const [tournamentName, setTournamentName] = useState('')
  const [maxRounds, setMaxRounds] = useState(DEFAULT_MAX_ROUNDS)
  const [format, setFormat] = useState<TournamentFormat>('swiss')
  const [elimFirstRound, setElimFirstRound] = useState<'elo' | 'random'>('elo')

  const count = rows.length
  const mParRonde = matchsParRonde(count)
  const mTotal = matchsAuTotal(count, maxRounds)
  const elimRoundsPlanned = eliminationMaxRounds(count)

  const onCountChange = (n: number) => {
    const c = Math.min(MAX_P, Math.max(MIN_P, n))
    setRows((prev) => {
      if (c === prev.length) return prev
      if (c > prev.length) {
        const extra = rowsFromPresets(c).slice(prev.length)
        return [...prev, ...extra]
      }
      return prev.slice(0, c)
    })
  }

  const fileRef = useRef<HTMLInputElement>(null)

  const onSubmit = async () => {
    const dupMsg = duplicatePlayerNameMessage(rows)
    if (dupMsg) {
      window.alert(dupMsg)
      return
    }
    const players: Player[] = rows.map((r) => ({
      id: generatePlayerId(),
      name: r.name.trim() || 'Sans nom',
      elo: Number.parseInt(r.elo, 10) || 0,
    }))
    await startTournament(
      players,
      tournamentName || null,
      format === 'swiss' ? maxRounds : null,
      format === 'elimination'
        ? { format: 'elimination', elimFirstRound }
        : { format: 'swiss' },
    )
    navigate('/tournaments/rounds')
  }

  const onImportFile = async (f: File | undefined) => {
    if (!f) return
    const text = await f.text()
    importStateJson(text)
    navigate('/tournaments/rounds')
  }

  const applyPreset = (rowIndex: number, presetIdx: string) => {
    if (presetIdx === '') return
    const i = Number.parseInt(presetIdx, 10)
    const p = PRESET_PLAYERS[i]
    if (!p) return
    if (isPresetUsedOnOtherRow(rows, rowIndex, i)) {
      window.alert(
        'Ce joueur de la liste est déjà sélectionné sur une autre ligne. Choisis un autre nom ou une autre entrée.',
      )
      return
    }
    setRows((prev) =>
      prev.map((row, j) =>
        j === rowIndex ? { name: p.name, elo: String(p.elo) } : row,
      ),
    )
  }

  if (isSpectator) {
    return (
      <PageLayout title="Configuration">
        <Card>
          <p className="text-sm text-zinc-600">
            Mode spectateur : les inscriptions se font sur l&apos;app locale
            organisateur.
          </p>
        </Card>
      </PageLayout>
    )
  }

  if (state) {
    return <Navigate to="/tournaments/rounds" replace />
  }

  return (
    <PageLayout title="Initialisation">
      <Card title="Tournoi" className="mb-6">
        <Label htmlFor="tn">Nom du tournoi</Label>
        <Input
          id="tn"
          value={tournamentName}
          onChange={(e) => setTournamentName(e.target.value)}
          placeholder={defaultTournamentName()}
          className="mt-1 w-full max-w-none sm:max-w-2xl"
        />
        <p className="mt-2 text-xs text-zinc-500">
          Laisse vide pour utiliser la date et l&apos;heure du moment où tu lances
          le tournoi (ex. : {defaultTournamentName()}).
        </p>
        <div className="mt-6 w-full max-w-none space-y-4">
          <div>
            <Label htmlFor="format">Format du tournoi</Label>
            <Select
              id="format"
              value={format}
              onChange={(e) =>
                setFormat(e.target.value as TournamentFormat)
              }
              className="mt-1 max-w-md"
            >
              <option value="swiss">
                Suisse (rondes classiques, classement aux points)
              </option>
              <option value="elimination">
                Élimination directe (coupe type Wikipédia + places 5 à N)
              </option>
            </Select>
          </div>
          {format === 'elimination' ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="elim-seed">Premier tour — appariement</Label>
                <Select
                  id="elim-seed"
                  value={elimFirstRound}
                  onChange={(e) =>
                    setElimFirstRound(
                      (e.target.value === 'random' ? 'random' : 'elo'),
                    )
                  }
                  className="mt-1 max-w-md"
                >
                  <option value="elo">
                    Par ELO (fort affronte faible, mieux classés exempts si
                    besoin)
                  </option>
                  <option value="random">Au hasard (ordre tiré au lancement)</option>
                </Select>
                <p className="mt-1.5 text-xs text-zinc-500">
                  Cet ordre définit les têtes de série pour le tableau (ELO ou
                  tirage). Les appariements des tours suivants sont imposés par la
                  structure de la coupe.
                </p>
              </div>
              <p className="text-sm text-zinc-700">
                Tableau sur puissance de 2 : exempts aux meilleurs seeds au besoin,
                première colonne façon tableau classique ; seuls les vainqueurs du
                tableau principal remontent vers la finale. Après les demi-finales :
                finale + petite finale (3ᵉ place). Pour les autres places :
                mini-tableaux à élimination. Environ{' '}
                <strong>{elimRoundsPlanned}</strong>{' '}
                {elimRoundsPlanned <= 1 ? 'grande vague' : 'grandes vagues'} de
                saisie. Nulle au tableau : départage en{' '}
                <strong>5 minutes</strong>, <strong>couleurs inversées</strong>.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-700">
                Le <strong>nombre de rondes</strong> choisi correspond au{' '}
                <strong>nombre de parties disputées par joueur</strong> (une
                partie par ronde ; en cas de nombre impair de joueurs, un
                exempt par ronde compte comme une ronde sans partie à
                l&apos;échiquier pour un inscrit).
              </p>
              <div>
                <Label htmlFor="mr">Nombre de rondes</Label>
                <Select
                  id="mr"
                  value={String(maxRounds)}
                  onChange={(e) =>
                    setMaxRounds(
                      Number.parseInt(e.target.value, 10) || DEFAULT_MAX_ROUNDS,
                    )
                  }
                  className="mt-1 max-w-xs"
                >
                  {Array.from(
                    { length: MAX_ROUNDS_CAP - MIN_ROUNDS + 1 },
                    (_, i) => MIN_ROUNDS + i,
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'ronde' : 'rondes'}
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-xs text-zinc-500">
                  Fixé au lancement ; tu peux aller jusqu&apos;à {MAX_ROUNDS_CAP}{' '}
                  rondes.
                </p>
              </div>
            </>
          )}
          <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 text-sm text-zinc-800">
            <p className="font-medium text-zinc-900">Matchs (parties à deux)</p>
            {format === 'swiss' ? (
              <ul className="mt-1.5 min-h-26 list-outside list-disc space-y-1.5 pl-5 text-zinc-700 sm:min-h-22">
                <li className="marker:text-zinc-400">
                  <strong>Par ronde</strong> : {mParRonde}{' '}
                  {mParRonde <= 1 ? 'match' : 'matchs'} — avec {count}{' '}
                  joueur{count > 1 ? 's' : ''}.
                  {count % 2 === 1 ? (
                    <>
                      {' '}
                      <span className="block pl-0 pt-0.5 text-zinc-600 sm:inline sm:pl-1 sm:pt-0">
                        (Impair : un exempt par ronde ; les autres jouent.)
                      </span>
                    </>
                  ) : null}
                </li>
                <li className="marker:text-zinc-400">
                  <strong>Au total sur le tournoi</strong> : {mTotal}{' '}
                  {mTotal <= 1 ? 'match' : 'matchs'} ({maxRounds}{' '}
                  {maxRounds === 1 ? 'ronde' : 'rondes'} × {mParRonde}).
                </li>
              </ul>
            ) : (
              <ul className="mt-1.5 list-outside list-disc space-y-1.5 pl-5 text-zinc-700">
                <li className="marker:text-zinc-400">
                  <strong>Rondes prévues</strong> : {elimRoundsPlanned} (selon la
                  taille du tableau, avec exempts si nécessaire).
                </li>
                <li className="marker:text-zinc-400">
                  Chaque joueur affronte des adversaires dans sa moitié de
                  classement jusqu&apos;à obtenir une place finale unique (1 à{' '}
                  {count}).
                </li>
              </ul>
            )}
          </div>
        </div>
      </Card>
      <Card title="Joueurs">
        <p className="mb-4 text-sm text-zinc-600">
          Nom et ELO sont préremplis avec la liste bureau ; tu peux tout modifier
          à la main ou choisir un joueur dans la liste pour une ligne.
        </p>
        {error ? (
          <p className="mb-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
          <div className="w-full min-w-0 sm:w-48">
            <Label htmlFor="n">Nombre de joueurs</Label>
            <Input
              id="n"
              type="number"
              min={MIN_P}
              max={MAX_P}
              value={count}
              onChange={(e) => onCountChange(Number(e.target.value))}
            />
            <p className="mt-1.5 min-h-11 text-xs leading-snug text-zinc-600">
              {format === 'swiss' ? (
                <>
                  Avec {count} joueur{count > 1 ? 's' : ''} et {maxRounds}{' '}
                  {maxRounds === 1 ? 'ronde' : 'rondes'} :{' '}
                  <strong>{mParRonde}</strong>{' '}
                  {mParRonde <= 1 ? 'match' : 'matchs'} par ronde,{' '}
                  <strong>{mTotal}</strong> au total.
                </>
              ) : (
                <>
                  Élimination : <strong>{elimRoundsPlanned}</strong>{' '}
                  {elimRoundsPlanned === 1 ? 'ronde' : 'rondes'} pour un
                  classement complet.
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" onClick={() => void onSubmit()}>
              Démarrer le tournoi
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
            >
              Importer JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) =>
                void onImportFile(e.target.files?.[0]).finally(() => {
                  e.target.value = ''
                })
              }
            />
          </div>
        </div>
        <div className="space-y-3">
          {rows.map((row, i) => {
            const matched = matchPresetIndex(row)
            return (
              <div
                key={i}
                className="grid grid-cols-1 gap-3 border-b border-zinc-100 pb-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-1 sm:pt-8">
                  <span className="text-sm text-zinc-500">{i + 1}</span>
                </div>
                <div className="sm:col-span-4">
                  <Label htmlFor={`preset-${i}`}>Liste</Label>
                  <Select
                    id={`preset-${i}`}
                    value={matched !== null ? String(matched) : ''}
                    onChange={(e) => applyPreset(i, e.target.value)}
                  >
                    <option value="">Saisie libre</option>
                    {PRESET_PLAYERS.map((p, idx) => {
                      const takenElsewhere =
                        matched !== idx &&
                        isPresetUsedOnOtherRow(rows, i, idx)
                      return (
                        <option key={idx} value={idx} disabled={takenElsewhere}>
                          {p.name} ({p.elo})
                        </option>
                      )
                    })}
                  </Select>
                </div>
                <div className="sm:col-span-4">
                  <Label htmlFor={`name-${i}`}>Nom</Label>
                  <Input
                    id={`name-${i}`}
                    value={row.name}
                    onChange={(e) => {
                      const v = e.target.value
                      setRows((prev) =>
                        prev.map((p, j) => (j === i ? { ...p, name: v } : p)),
                      )
                    }}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label htmlFor={`elo-${i}`}>ELO</Label>
                  <Input
                    id={`elo-${i}`}
                    inputMode="numeric"
                    value={row.elo}
                    onChange={(e) => {
                      const v = e.target.value
                      setRows((prev) =>
                        prev.map((p, j) => (j === i ? { ...p, elo: v } : p)),
                      )
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </PageLayout>
  )
}
