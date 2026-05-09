import type { BracketMatchVisual } from '../domain/eliminationBracketGraph'
import type { TournamentState } from '../domain/types'

function playerName(state: TournamentState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? id
}

function nameRowClass(
  won: boolean,
  lost: boolean,
  salon: boolean,
): string {
  if (salon) {
    if (won) {
      return 'truncate rounded bg-[#e8f0e9]/95 px-0.5 text-sm font-semibold leading-tight text-[#123524] ring-1 ring-[#6b9473]/45 sm:text-[13px]'
    }
    if (lost) {
      return 'truncate text-sm font-normal leading-tight text-[#76665a] opacity-90 sm:text-[13px]'
    }
    return 'truncate text-sm font-medium leading-tight text-[#221a13] sm:text-[13px]'
  }
  if (won) {
    return 'truncate rounded px-0.5 text-sm font-semibold leading-tight text-emerald-950 ring-1 ring-emerald-500/40 sm:text-[13px]'
  }
  if (lost) {
    return 'truncate text-sm font-normal leading-tight text-zinc-500 opacity-85 sm:text-[13px]'
  }
  return 'truncate text-sm font-medium leading-tight text-zinc-900 sm:text-[13px]'
}

function DuelCard({
  state,
  m,
  salon,
}: {
  state: TournamentState
  m: BracketMatchVisual
  salon: boolean
}) {
  const hasB = m.playerBId !== null
  const wonA = Boolean(m.resolved && m.winnerId === m.playerAId)
  const wonB = Boolean(m.resolved && m.winnerId === m.playerBId)
  const loserA = Boolean(
    m.resolved && hasB && m.winnerId && m.playerAId !== m.winnerId,
  )
  const loserB = Boolean(
    m.resolved && hasB && m.winnerId && m.playerBId !== m.winnerId,
  )
  const byeBox =
    m.playerBId === null ?
      salon ?
        'border-[#c49a53]/65 bg-[#faf3e8]/90'
      : 'border-amber-200/80 bg-amber-50/50'
    : ''
  const resolvedRing =
    m.resolved && hasB ?
      salon ? 'ring-1 ring-[#6b9473]/40'
      : 'ring-1 ring-emerald-400/35'
    : ''
  const frame =
    salon ?
      'min-w-[10.5rem] max-w-full flex-1 rounded-xl border border-[#c9b89a]/90 bg-[#fffdf9] px-3 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_2px_8px_rgb(60_42_28/0.08)] sm:min-w-[12rem]'
    : 'min-w-[10.5rem] max-w-full flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm sm:min-w-[12rem]'

  return (
    <div className={`${frame} ${byeBox} ${resolvedRing}`}>
      <div className={nameRowClass(wonA, loserA, salon)}>
        {playerName(state, m.playerAId)}
      </div>
      {m.playerBId ?
        <>
          <div
            className={`my-1.5 border-t ${salon ? 'border-[#dfd0bc]' : 'border-zinc-200'}`}
          />
          <div className={nameRowClass(wonB, loserB, salon)}>
            {playerName(state, m.playerBId)}
          </div>
        </>
      : (
        <p
          className={`mt-1 text-xs italic ${salon ? 'text-[#867666]' : 'text-zinc-500'}`}
        >
          Exempt
        </p>
      )}
    </div>
  )
}

function sortBySlot(a: BracketMatchVisual, b: BracketMatchVisual): number {
  return (a.placementSlot ?? 0) - (b.placementSlot ?? 0)
}

/**
 * Mini-tableaux de placement : une carte par duel, ordre chronologique lisible
 * (plus de colonnes « Vainqueurs / Perdants » qui prêtent à confusion en SVG).
 */
export function PlacementBracketDuelCards({
  state,
  cohort,
  lostAtRoundLabel,
  visualTone = 'default',
}: {
  state: TournamentState
  cohort: BracketMatchVisual[]
  /** Ex. « Quart de finale » — phase du tableau principal dont viennent ces perdants. */
  lostAtRoundLabel: string
  visualTone?: 'default' | 'salon'
}) {
  if (cohort.length === 0) return null

  const salon = visualTone === 'salon'

  const maxDepth = Math.max(
    0,
    ...cohort.map((m) => m.placementDepth ?? 0),
  )

  return (
    <div className="space-y-6">
      <p
        className={`text-xs leading-relaxed ${salon ? 'text-[#4f4238]' : 'text-zinc-600'}`}
      >
        Chaque carte ci-dessous correspond à <strong>un seul duel</strong> entre
        deux joueurs. Il s&apos;agit des perdants du tableau principal sortis après
        la phase <strong>{lostAtRoundLabel}</strong>, puis des confrontations suivantes
        (vainqueurs et perdants des duels précédents jouent séparément, pour ranger
        toutes les places restantes dans ce tableau).
      </p>

      {Array.from({ length: maxDepth + 1 }, (_, d) => d).map((depth) => {
        const atDepth = cohort
          .filter((m) => (m.placementDepth ?? 0) === depth)
          .sort(sortBySlot)

        if (atDepth.length === 0) return null

        if (depth === 0) {
          return (
            <div key={`pl-d0`} className="space-y-2">
              <h3
                className={`text-xs font-semibold uppercase tracking-wide ${salon ? 'font-display text-[#402a18] tracking-[0.12em]' : 'text-zinc-700'}`}
              >
                Étape 1 — duels entre perdants ({lostAtRoundLabel})
              </h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {atDepth.map((m) => (
                  <DuelCard key={m.key} state={state} m={m} salon={salon} />
                ))}
              </div>
            </div>
          )
        }

        const wMatches = atDepth
          .filter((m) => m.placementLane === 'W')
          .sort(sortBySlot)
        const lMatches = atDepth
          .filter((m) => m.placementLane === 'L')
          .sort(sortBySlot)

        return (
          <div key={`pl-d${depth}`} className="space-y-4">
            {wMatches.length > 0 ?
              <div className="space-y-2">
                <h3
                  className={`text-xs font-semibold uppercase tracking-wide ${salon ? 'font-display text-[#402a18] tracking-[0.12em]' : 'text-zinc-700'}`}
                >
                  Étape {depth + 1} — duels entre les{' '}
                  <span className={salon ? 'text-[#174a34]' : 'text-emerald-800'}>
                    vainqueurs
                  </span>{' '}
                  des duels précédents (meilleures places de ce mini-tableau)
                </h3>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {wMatches.map((m) => (
                    <DuelCard key={m.key} state={state} m={m} salon={salon} />
                  ))}
                </div>
              </div>
            : null}
            {lMatches.length > 0 ?
              <div className="space-y-2">
                <h3
                  className={`text-xs font-semibold uppercase tracking-wide ${salon ? 'font-display text-[#402a18] tracking-[0.12em]' : 'text-zinc-700'}`}
                >
                  Étape {depth + 1} — duels entre les{' '}
                  <span className={salon ? 'text-[#5c4838]' : 'text-zinc-600'}>
                    perdants
                  </span>{' '}
                  des duels précédents (places plus basses)
                </h3>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {lMatches.map((m) => (
                    <DuelCard key={m.key} state={state} m={m} salon={salon} />
                  ))}
                </div>
              </div>
            : null}
          </div>
        )
      })}
    </div>
  )
}
