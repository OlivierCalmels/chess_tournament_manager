import { useMemo } from 'react'
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
  placementVisualColumnIndex,
  type BracketMatchLaidOut,
  type BracketMatchVisual,
  type LayoutBracketColumnHeader,
  type OrthogonalConnectorStyle,
} from '../domain/eliminationBracketGraph'
import type { TournamentState } from '../domain/types'
import { Card } from './Card'

type Props = {
  state: TournamentState
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

function BracketPanelSvg(props: {
  state: TournamentState
  ariaLabel: string
  svgTitle: string
  laid: BracketMatchLaidOut[]
  edges: { d: string; key: string }[]
  svgW: number
  svgH: number
  columnPhases: LayoutBracketColumnHeader[]
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
  } = props

  if (laid.length === 0) return null

  return (
    <div className="w-full overflow-x-auto pb-1">
      <svg
        width={svgW}
        height={svgH}
        className="min-w-0 shrink-0 text-zinc-900"
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
            className="fill-zinc-500 text-[10px] font-medium uppercase tracking-wide"
          >
            {col.label}
          </text>
        ))}
        {edges.map((e) => (
          <path
            key={e.key}
            d={e.d}
            fill="none"
            stroke="#a1a1aa"
            strokeWidth={1}
            opacity={0.85}
          />
        ))}
        {laid.map((m) => {
          const { lx, ly, boxW, boxH } = m.layout
          const wonA = Boolean(m.resolved && m.winnerId === m.playerAId)
          const wonB = Boolean(m.resolved && m.winnerId === m.playerBId)
          const byeCls =
            m.playerBId === null ?
              'stroke-amber-200/80 fill-amber-50/40'
            : ''
          return (
            <g key={m.key}>
              <rect
                x={lx}
                y={ly}
                width={boxW}
                height={boxH}
                rx={6}
                className={`fill-white stroke-[1px] stroke-zinc-300 ${byeCls}`}
              />
              <foreignObject
                x={lx + 6}
                y={ly + 4}
                width={boxW - 12}
                height={18}
              >
                <div
                  className={`truncate text-[11px] leading-tight ${wonA ? 'font-semibold text-emerald-800' : 'text-zinc-800'}`}
                >
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
                    stroke="#e4e4e7"
                    strokeWidth={1}
                  />
                  <foreignObject
                    x={lx + 6}
                    y={ly + boxH / 2 + 3}
                    width={boxW - 12}
                    height={18}
                  >
                    <div
                      className={`truncate text-[11px] leading-tight ${wonB ? 'font-semibold text-emerald-800' : 'text-zinc-800'}`}
                    >
                      {playerName(state, m.playerBId)}
                    </div>
                  </foreignObject>
                </>
              : (
                <foreignObject
                  x={lx + 6}
                  y={ly + 22}
                  width={boxW - 12}
                  height={18}
                >
                  <div className="text-[10px] italic leading-tight text-zinc-500">
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
  layoutOpts: {
    columnOf: (m: BracketMatchVisual) => number
    rowKey?: (m: BracketMatchVisual) => number
    columnLabel?: (colKey: number) => string
  },
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
export function EliminationBracketTree({ state }: Props) {
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
    )
    const { edges } = laidEdgesFrom(laid, 'midpoint')
    return { laid, edges, svgW, svgH, columnPhases }
  }, [state, useLegacyElimLayout])

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

    const placementLayouts = allCohortKeys.map((dm) => {
      const cohort = placementsByCohort.get(dm) ?? []
      const phaseFr = eliminationPhaseLabelFr(dm + 1, maxMainDepth + 1)
      return {
        cohortKey: dm,
        title: `Mini-tableau — perdants ${phaseFr.toLowerCase()}`,
        layout: layoutPanelMatches(state, cohort, {
          columnOf: placementVisualColumnIndex,
          rowKey: (m) => m.placementSlot ?? m.slotIndex,
          columnLabel: (col) =>
            col === 0 ? 'Tour 1' : col % 2 === 0 ? 'Vainqueurs' : 'Perdants',
        }, 'nearParent'),
      }
    }).filter((p) => p.layout && p.layout!.laid.length > 0)

    return {
      mainLayout,
      bronzeLayout,
      placementLayouts,
    }
  }, [state, useLegacyElimLayout])

  if (useLegacyElimLayout) {
    if (!legacyPanel?.laid.length) return null
    return (
      <Card
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
        />
        <p className="mt-2 max-w-4xl text-xs leading-snug text-zinc-500">
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
    if (!row.layout?.laid.length) continue
    navSections.push({
      id: `lb-elim-placement-${row.cohortKey}`,
      label: row.title,
    })
  }

  return (
    <div className="mb-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-xs font-medium text-zinc-600">
          Vues tableau : coupe, petite finale et mini-tableaux (classement
          synthétique plus bas).
        </p>
        {navSections.length > 1 ?
          <nav
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs"
            aria-label="Aller aux vues du tableau à élimination"
          >
            {navSections.map(({ id, label }, i) => (
              <span key={id} className="inline-flex items-center gap-x-4">
                {i ? (
                  <span className="text-zinc-300" aria-hidden>
                    ·
                  </span>
                ) : null}
                <a
                  href={`#${id}`}
                  className="font-medium text-zinc-800 underline underline-offset-2 hover:text-zinc-600"
                >
                  {label}
                </a>
              </span>
            ))}
          </nav>
        : null}
      </div>
      <div className="flex flex-wrap items-start gap-4">
        {v3Panels?.mainLayout?.laid.length ?
          <section
            id="lb-elim-main"
            className="scroll-mt-20 min-w-[min(100%,320px)] shrink-0 grow-0"
          >
            <Card title="Coupe principale">
              <BracketPanelSvg
                state={state}
                ariaLabel="Coupe principale"
                svgTitle="Coupe principale"
                laid={v3Panels.mainLayout.laid}
                edges={v3Panels.mainLayout.edges}
                svgW={v3Panels.mainLayout.svgW}
                svgH={v3Panels.mainLayout.svgH}
                columnPhases={v3Panels.mainLayout.columnPhases}
              />
            </Card>
          </section>
        : null}
        {v3Panels?.bronzeLayout?.laid.length ?
          <section
            id="lb-elim-bronze"
            className="scroll-mt-20 min-w-[min(100%,260px)] shrink-0 grow-0"
          >
            <Card title="Petite finale — 3ᵉ place">
              <BracketPanelSvg
                state={state}
                ariaLabel="Petite finale"
                svgTitle="Match pour la troisième place"
                laid={v3Panels.bronzeLayout.laid}
                edges={v3Panels.bronzeLayout.edges}
                svgW={v3Panels.bronzeLayout.svgW}
                svgH={v3Panels.bronzeLayout.svgH}
                columnPhases={v3Panels.bronzeLayout.columnPhases}
              />
            </Card>
          </section>
        : null}
        {v3Panels?.placementLayouts?.map(({ cohortKey, title, layout }) => {
          if (!layout?.laid.length) return null
          return (
            <section
              key={`pl-${cohortKey}`}
              id={`lb-elim-placement-${cohortKey}`}
              className="scroll-mt-20 min-w-[min(100%,300px)] shrink-0 grow-0"
            >
              <Card title={title}>
                <BracketPanelSvg
                  state={state}
                  ariaLabel={title}
                  svgTitle={title}
                  laid={layout.laid}
                  edges={layout.edges}
                  svgW={layout.svgW}
                  svgH={layout.svgH}
                  columnPhases={layout.columnPhases}
                />
              </Card>
            </section>
          )
        })}
      </div>
      <p className="mt-3 max-w-4xl text-xs leading-snug text-zinc-500">
        La coupe utilise les colonnes quart / demi / finale (suivant le nombre de
        participants). Les lignes relient deux matchs quand leur vainqueurs ou
        perdants s’affrontent au tour suivant dans le même sous-tableau.
      </p>
    </div>
  )
}
