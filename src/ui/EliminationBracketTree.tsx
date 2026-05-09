import { useEffect, useMemo, useState } from 'react'
import {
  bracketSize,
  eliminationIsLegacyState,
  eliminationPhaseLabelFr,
  cohortMainDepthsForPlacement,
} from '../domain/eliminationPairing'
import {
  eliminationBracketMatches,
  layoutEliminationBracket,
  layoutEliminationBracketByColumns,
  orthogonalConnector,
  partitionEliminationBracketVisuals,
  type BracketMatchLaidOut,
  type BracketMatchVisual,
  type LayoutBracketColumnHeader,
  type LayoutBracketOpts,
  type OrthogonalConnectorStyle,
} from '../domain/eliminationBracketGraph'
import type { TournamentState } from '../domain/types'
import { Card } from './Card'
import { PlacementBracketDuelCards } from './PlacementBracketDuelCards'

type Props = {
  state: TournamentState
  /** Palette bois / parchemin (page classement). */
  visualTone?: 'default' | 'salon'
}

function playerName(state: TournamentState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? id
}

function laidEdgesFrom(
  laid: BracketMatchLaidOut[],
  connectorStyle: OrthogonalConnectorStyle,
): { edges: { d: string; key: string }[] } {
  const byKey = new Map(laid.map((m) => [m.key, m]))
  type EdgeCand = {
    pk: string
    chKey: string
    x1: number
    y1: number
    x2: number
    y2: number
  }
  const cands: EdgeCand[] = []

  for (const child of laid) {
    const [pk0, pk1] = child.incomingKeys
    const targets = [[pk0, child], [pk1, child]] as const
    for (const [pk, ch] of targets) {
      if (!pk) continue
      const parent = byKey.get(pk)
      if (!parent) continue
      const insetOut = Math.min(14, Math.floor(parent.layout.boxW / 18))
      const insetIn = Math.min(12, Math.floor(ch.layout.boxW / 20))
      cands.push({
        pk,
        chKey: ch.key,
        x1: parent.layout.lx + parent.layout.boxW - insetOut,
        y1: parent.layout.ly + parent.layout.boxH / 2,
        x2: ch.layout.lx + insetIn,
        y2: ch.layout.ly + ch.layout.boxH / 2,
      })
    }
  }

  const byFeeder = new Map<string, EdgeCand[]>()
  for (const c of cands) {
    const arr = byFeeder.get(c.pk) ?? []
    arr.push(c)
    byFeeder.set(c.pk, arr)
  }

  const edgeList: { d: string; key: string }[] = []
  for (const [, group] of byFeeder) {
    const sorted =
      connectorStyle === 'nearParent' && group.length > 1
        ? [...group].sort((a, b) => a.chKey.localeCompare(b.chKey))
        : group

    sorted.forEach((c, i) => {
      const stagger =
        connectorStyle === 'nearParent' && sorted.length > 1
          ? (i - (sorted.length - 1) / 2) * 7
          : 0
      edgeList.push({
        key: `${c.pk}->${c.chKey}`,
        d: orthogonalConnector(c.x1, c.y1, c.x2, c.y2, {
          style: connectorStyle,
          midXBias: stagger,
        }),
      })
    })
  }

  return { edges: edgeList }
}

function useEliminationBracketPhoneLayout(): boolean {
  const [compact, setCompact] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 639px)').matches
  })
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const onChange = () => setCompact(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return compact
}

function phoneLayoutBracketOpts(
  compact: boolean,
): Pick<LayoutBracketOpts, 'colGap' | 'rowStep' | 'boxW' | 'boxH'> {
  return compact ?
      { boxW: 158, boxH: 62, rowStep: 68, colGap: 20 }
    : {}
}

function BracketPanelSvg(props: {
  state: TournamentState
  ariaLabel: string
  svgTitle: string
  laid: BracketMatchLaidOut[]
  edges: { d: string; key: string }[]
  svgW: number
  svgH: number
  columnPhases: LayoutBracketColumnHeader[]
  tone?: 'default' | 'salon'
}) {
  const {
    state,
    ariaLabel,
    svgTitle,
    laid,
    edges,
    svgW,
    svgH,
    columnPhases,
    tone = 'default',
  } = props

  if (laid.length === 0) return null

  const edgeStroke = tone === 'salon' ? '#9a7f66' : '#a1a1aa'

  const nameLineClasses = (won: boolean, lost: boolean) => {
    if (tone === 'salon') {
      if (won) {
        return 'truncate rounded bg-[#e4efe5]/95 px-0.5 text-[13px] font-semibold leading-tight text-[#123524] ring-1 ring-[#6b9473]/50 sm:text-[11px]'
      }
      if (lost) {
        return 'truncate text-[13px] font-normal leading-tight text-[#7d6f62] opacity-88 sm:text-[11px]'
      }
      return 'truncate text-[13px] font-medium leading-tight text-[#262019] sm:text-[11px]'
    }
    if (won) {
      return 'truncate rounded px-0.5 text-[13px] font-semibold leading-tight text-emerald-950 ring-1 ring-emerald-500/35 sm:text-[11px] sm:ring-0'
    }
    if (lost) {
      return 'truncate text-[13px] font-normal leading-tight text-zinc-500 opacity-80 sm:text-[11px]'
    }
    return 'truncate text-[13px] font-medium leading-tight text-zinc-900 sm:text-[11px]'
  }

  return (
    <div
      className={
        '-mx-4 max-w-none pb-2 max-sm:w-[calc(100%+2rem)] max-sm:touch-pan-x max-sm:overflow-x-auto sm:mx-0 sm:w-full sm:overflow-x-visible'
      }
    >
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        height="auto"
        preserveAspectRatio="xMidYMin meet"
        className="block h-auto min-w-0 max-w-full text-zinc-900 max-sm:min-w-[28rem] sm:min-w-0"
        role="img"
        aria-label={ariaLabel}
      >
        <title>{svgTitle}</title>
        {columnPhases.map((col) => (
          <text
            key={`hdr-${col.columnKey}`}
            x={col.xCenter}
            y={18}
            textAnchor="middle"
            className={`text-[11px] font-medium uppercase tracking-wide sm:text-[10px] ${tone === 'salon' ? 'fill-[#5c4838]' : 'fill-zinc-500'}`}
          >
            {col.label}
          </text>
        ))}
        {edges.map((e) => (
          <path
            key={e.key}
            d={e.d}
            fill="none"
            stroke={edgeStroke}
            strokeWidth={1}
            opacity={tone === 'salon' ? 0.9 : 0.85}
          />
        ))}
        {laid.map((m) => {
          const { lx, ly, boxW, boxH } = m.layout
          const hasB = m.playerBId !== null
          const wonA = Boolean(m.resolved && m.winnerId === m.playerAId)
          const wonB = Boolean(m.resolved && m.winnerId === m.playerBId)
          const loserA = Boolean(
            m.resolved && hasB && m.winnerId && m.playerAId !== m.winnerId,
          )
          const loserB = Boolean(
            m.resolved && hasB && m.winnerId && m.playerBId !== m.winnerId,
          )
          const byeCls =
            m.playerBId === null ?
              tone === 'salon' ?
                'stroke-[#c4a574]/90 fill-[#faf3e8]/95'
              : 'stroke-amber-200/80 fill-amber-50/40'
            : ''
          const matchResolvedCls =
            m.resolved && hasB ?
              tone === 'salon' ? 'stroke-[#6b9473]/55'
              : 'stroke-emerald-400/50'
            : ''
          const shellCls =
            tone === 'salon' ?
              'fill-[#fdfaf5] stroke-[1px] stroke-[#c9b298]'
            : 'fill-white stroke-[1px] stroke-zinc-300'
          return (
            <g key={m.key}>
              <rect
                x={lx}
                y={ly}
                width={boxW}
                height={boxH}
                rx={6}
                className={`${shellCls} ${byeCls} ${matchResolvedCls}`}
              />
              <foreignObject
                x={lx + 6}
                y={ly + 3}
                width={boxW - 12}
                height={22}
              >
                <div className={nameLineClasses(wonA, loserA)}>
                  {playerName(state, m.playerAId)}
                </div>
              </foreignObject>
              {m.playerBId ?
                <>
                  <line
                    x1={lx + 8}
                    y1={ly + boxH / 2}
                    x2={lx + boxW - 8}
                    y2={ly + boxH / 2}
                    stroke={tone === 'salon' ? '#d4c4b0' : '#e4e4e7'}
                    strokeWidth={1}
                  />
                  <foreignObject
                    x={lx + 6}
                    y={ly + boxH / 2 + 2}
                    width={boxW - 12}
                    height={22}
                  >
                    <div className={nameLineClasses(wonB, loserB)}>
                      {playerName(state, m.playerBId)}
                    </div>
                  </foreignObject>
                </>
              : (
                <foreignObject
                  x={lx + 6}
                  y={ly + 24}
                  width={boxW - 12}
                  height={20}
                >
                  <div
                    className={`text-[12px] italic leading-tight sm:text-[10px] ${tone === 'salon' ? 'text-[#8a7b6c]' : 'text-zinc-500'}`}
                  >
                    exempt
                  </div>
                </foreignObject>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function layoutPanelMatches(
  state: TournamentState,
  subset: BracketMatchVisual[],
  layoutOpts: Pick<
    LayoutBracketOpts,
    | 'columnOf'
    | 'rowKey'
    | 'columnLabel'
    | 'colGap'
    | 'rowStep'
    | 'boxW'
    | 'boxH'
  >,
  connectorStyle: OrthogonalConnectorStyle,
): {
  laid: BracketMatchLaidOut[]
  svgW: number
  svgH: number
  columnPhases: LayoutBracketColumnHeader[]
  edges: { d: string; key: string }[]
} {
  const mr = Math.max(1, state.maxRounds)
  if (subset.length === 0) {
    return { laid: [], svgW: 0, svgH: 0, columnPhases: [], edges: [] }
  }
  const { laid, svgW, svgH, columnPhases } = layoutEliminationBracketByColumns(
    subset,
    mr,
    layoutOpts,
  )
  const { edges } = laidEdgesFrom(laid, connectorStyle)
  return { laid, svgW, svgH, columnPhases, edges }
}

/** Tableau coupe v3 : panneaux par sous-tournoi ; legacy : une seule vue par ronde. */
export function EliminationBracketTree({
  state,
  visualTone = 'default',
}: Props) {
  const cardTone = visualTone === 'salon' ? 'salon' : 'default'
  const elimPhoneLayout = useEliminationBracketPhoneLayout()
  const layoutDim = useMemo(
    () => phoneLayoutBracketOpts(elimPhoneLayout),
    [elimPhoneLayout],
  )

  const useLegacyElimLayout =
    eliminationIsLegacyState(state) ||
    (state.format ?? 'swiss') !== 'elimination'

  const legacyPanel = useMemo(() => {
    if (!useLegacyElimLayout) return null
    const matches = eliminationBracketMatches(state)
    if (matches.length === 0) return null

    const { laid, svgW, svgH, columnPhases } = layoutEliminationBracket(
      matches,
      Math.max(1, state.maxRounds),
      layoutDim,
    )
    const { edges } = laidEdgesFrom(laid, 'midpoint')
    return { laid, edges, svgW, svgH, columnPhases }
  }, [state, useLegacyElimLayout, layoutDim])

  const v3Panels = useMemo(() => {
    if (useLegacyElimLayout) return null
    const matches = eliminationBracketMatches(state)
    if (matches.length === 0) return null

    const n = state.players.length
    const b = bracketSize(n)
    const maxMainDepth = Math.max(0, Math.round(Math.log2(b)) - 1)

    const { main, bronze, placementsByCohort } =
      partitionEliminationBracketVisuals(matches)

    const mainLayout =
      main.length === 0
        ? null
        : layoutPanelMatches(state, main, {
            ...layoutDim,
            columnOf: (m) =>
              typeof m.mainDepth === 'number' ? m.mainDepth : 0,
            rowKey: (m) => m.mainSlot ?? m.slotIndex,
            columnLabel: (d) =>
              eliminationPhaseLabelFr(d + 1, maxMainDepth + 1),
          }, 'midpoint')

    const bronzeLayout =
      bronze.length === 0
        ? null
        : layoutPanelMatches(state, bronze, {
            ...layoutDim,
            columnOf: () => 0,
            columnLabel: () => 'Petite finale',
          }, 'midpoint')

    /** Ordre cohortes aligné sur le moteur (QF, …). */
    const cohortOrder = [...cohortMainDepthsForPlacement(b)].filter((dm) =>
      placementsByCohort.has(dm),
    )
    /** Cohortes présentes dans les données mais hors liste théorique (robustesse). */
    const extraCohort = [...placementsByCohort.keys()]
      .filter((dm) => !cohortOrder.includes(dm))
      .sort((a, b) => a - b)
    const allCohortKeys = [...cohortOrder, ...extraCohort]

    const placementLayouts = allCohortKeys
      .map((dm) => {
        const cohort = placementsByCohort.get(dm) ?? []
        const phaseFr = eliminationPhaseLabelFr(dm + 1, maxMainDepth + 1)
        return {
          cohortKey: dm,
          title: `Mini-tableau — perdants ${phaseFr.toLowerCase()}`,
          cohort,
          phaseFr,
        }
      })
      .filter((p) => p.cohort.length > 0)

    return {
      mainLayout,
      bronzeLayout,
      placementLayouts,
    }
  }, [state, useLegacyElimLayout, layoutDim])

  if (useLegacyElimLayout) {
    if (!legacyPanel?.laid.length) return null
    return (
      <Card
        tone={cardTone}
        title="Tableau à élimination (coupe compacte sans sous-vues séparées)"
        className="mb-6"
      >
        <BracketPanelSvg
          state={state}
          ariaLabel="Tableau d’élimination"
          svgTitle="Tableau à élimination directe"
          laid={legacyPanel.laid}
          edges={legacyPanel.edges}
          svgW={legacyPanel.svgW}
          svgH={legacyPanel.svgH}
          columnPhases={legacyPanel.columnPhases}
          tone={visualTone}
        />
        <p
          className={`mt-2 max-w-4xl text-xs leading-snug ${visualTone === 'salon' ? 'text-[#5c4d42]' : 'text-zinc-500'}`}
        >
          Lecture gauche→droite : phases successives du fichier importé ; les lignes relient les matchs où les vainqueurs se retrouvent.
        </p>
      </Card>
    )
  }

  if (
    !v3Panels?.mainLayout?.laid.length &&
    !v3Panels?.bronzeLayout?.laid.length &&
    (v3Panels?.placementLayouts?.length ?? 0) === 0
  ) {
    return null
  }

  const navSections: { id: string; label: string }[] = []
  if (v3Panels?.mainLayout?.laid.length) {
    navSections.push({
      id: 'lb-elim-main',
      label: 'Coupe principale',
    })
  }
  if (v3Panels?.bronzeLayout?.laid.length) {
    navSections.push({
      id: 'lb-elim-bronze',
      label: 'Petite finale — 3ᵉ place',
    })
  }
  for (const row of v3Panels?.placementLayouts ?? []) {
    if (!row.cohort.length) continue
    navSections.push({
      id: `lb-elim-placement-${row.cohortKey}`,
      label: row.title,
    })
  }

  const salon = visualTone === 'salon'

  return (
    <div className="mb-6">
      <div
        className={`mb-4 rounded-xl px-3 py-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-0 sm:py-0 ${salon ? 'salon-muted' : ''}`}
      >
        <p
          className={`text-xs font-medium leading-snug ${salon ? 'text-[#4a3c33]' : 'text-zinc-600'}`}
        >
          Vues tableau : coupe, petite finale et mini-tableaux (classement
          synthétique plus bas).
        </p>
        {navSections.length > 1 ?
          <nav
            className="mt-2 flex flex-wrap items-start gap-x-3 gap-y-2 text-xs leading-snug sm:mt-0 sm:items-center sm:gap-x-4 sm:text-xs"
            aria-label="Aller aux vues du tableau à élimination"
          >
            {navSections.map(({ id, label }, i) => (
              <span key={id} className="inline-flex items-center gap-x-4">
                {i ? (
                  <span
                    className={salon ? 'text-[#b8a894]' : 'text-zinc-300'}
                    aria-hidden
                  >
                    ·
                  </span>
                ) : null}
                <a
                  href={`#${id}`}
                  className={`font-medium underline underline-offset-2 ${salon ? 'text-[#5a3d28] decoration-[#a8896c]/60 hover:text-[#402a1a]' : 'text-zinc-800 hover:text-zinc-600'}`}
                >
                  {label}
                </a>
              </span>
            ))}
          </nav>
        : null}
      </div>
      <div className="flex flex-col items-stretch gap-8">
        {v3Panels?.mainLayout?.laid.length ?
          <section id="lb-elim-main" className="scroll-mt-20 w-full min-w-0">
            <Card
              tone={cardTone}
              title="Coupe principale"
              titleClassName="text-base lg:text-lg"
            >
              <BracketPanelSvg
                state={state}
                ariaLabel="Coupe principale"
                svgTitle="Coupe principale"
                laid={v3Panels.mainLayout.laid}
                edges={v3Panels.mainLayout.edges}
                svgW={v3Panels.mainLayout.svgW}
                svgH={v3Panels.mainLayout.svgH}
                columnPhases={v3Panels.mainLayout.columnPhases}
                tone={visualTone}
              />
            </Card>
          </section>
        : null}
        {v3Panels?.bronzeLayout?.laid.length ?
          <section id="lb-elim-bronze" className="scroll-mt-20 w-full min-w-0">
            <Card
              tone={cardTone}
              title="Petite finale — 3ᵉ place"
              titleClassName="text-base lg:text-lg"
            >
              <BracketPanelSvg
                state={state}
                ariaLabel="Petite finale"
                svgTitle="Match pour la troisième place"
                laid={v3Panels.bronzeLayout.laid}
                edges={v3Panels.bronzeLayout.edges}
                svgW={v3Panels.bronzeLayout.svgW}
                svgH={v3Panels.bronzeLayout.svgH}
                columnPhases={v3Panels.bronzeLayout.columnPhases}
                tone={visualTone}
              />
            </Card>
          </section>
        : null}
        {v3Panels?.placementLayouts?.map(({ cohortKey, title, cohort, phaseFr }) => {
          return (
            <section
              key={`pl-${cohortKey}`}
              id={`lb-elim-placement-${cohortKey}`}
              className="scroll-mt-20 w-full min-w-0"
            >
              <Card tone={cardTone} title={title} titleClassName="text-base lg:text-lg">
                <PlacementBracketDuelCards
                  state={state}
                  cohort={cohort}
                  lostAtRoundLabel={phaseFr}
                  visualTone={visualTone}
                />
              </Card>
            </section>
          )
        })}
      </div>
      <p
        className={`mt-3 max-w-4xl text-xs leading-snug ${salon ? 'text-[#5c4d42]' : 'text-zinc-500'}`}
      >
        Sur la coupe, les lignes relient deux matchs quand leurs vainqueurs ou leurs perdants se retrouvent au tour suivant. Les perdants hors podium jouent ensuite des duels présentés en cartes (un duel = une carte) dans les mini-tableaux.
      </p>
    </div>
  )
}
