import {
  bracketSize,
  bronzeMatchKey,
  eliminationIsLegacyState,
  eliminationMatchTitleFr,
  eliminationPairingWinnerLoser,
  eliminationPhaseLabelFr,
  mainMatchKey,
} from './eliminationPairing'
import { pairingIsResolved } from './scoring'
import type { EliminationPairingMeta, TournamentState } from './types'

export type BracketMatchVisual = {
  /** Identifiant stable : `elim.key` (nouveau moteur) ou `r{round}-m{slot}` (legacy). */
  key: string
  roundIndex: number
  slotIndex: number
  playerAId: string
  playerBId: string | null
  /** Références aux `elim.key` des parents (nouveau), ou ancien pedigree joueur → clé legacy. */
  incomingKeys: [string | null, string | null]
  winnerId: string | null
  loserId: string | null
  resolved: boolean
  phaseShort: string
  /** Renseignés en coupe v3 ; absents pour le legacy sans `elim`. */
  elimKind?: EliminationPairingMeta['kind']
  mainDepth?: number
  mainSlot?: number
  cohortMainDepth?: number
  placementDepth?: number
  placementSlot?: number
  placementLane?: EliminationPairingMeta['placementLane']
}

function eliminationBracketMatchesLegacy(
  state: TournamentState,
): BracketMatchVisual[] {
  const format = state.format ?? 'elimination'
  const maxRounds = Math.max(1, state.maxRounds)
  const rounds = [...state.rounds].sort((a, b) => a.roundIndex - b.roundIndex)
  const playerLastMatch = new Map<string, string>()
  const visuals: BracketMatchVisual[] = []

  for (const rnd of rounds) {
    const lineageAtRoundStart = new Map(playerLastMatch)
    rnd.pairings.forEach((pairing, slotIndex) => {
      const key = `r${rnd.roundIndex}-m${slotIndex}`
      const inc: [string | null, string | null] =
        pairing.playerBId === null
          ? [lineageAtRoundStart.get(pairing.playerAId) ?? null, null]
          : [
              lineageAtRoundStart.get(pairing.playerAId) ?? null,
              lineageAtRoundStart.get(pairing.playerBId) ?? null,
            ]

      const resolved = pairingIsResolved(pairing, format)
      let { winnerId, loserId } = eliminationPairingWinnerLoser(pairing)
      if (!resolved && pairing.playerBId !== null) {
        winnerId = null
        loserId = null
      }

      visuals.push({
        key,
        roundIndex: rnd.roundIndex,
        slotIndex,
        playerAId: pairing.playerAId,
        playerBId: pairing.playerBId,
        incomingKeys: inc,
        winnerId,
        loserId,
        resolved,
        phaseShort: eliminationPhaseLabelFr(rnd.roundIndex, maxRounds),
      })
    })

    rnd.pairings.forEach((pairing, slotIndex) => {
      const key = `r${rnd.roundIndex}-m${slotIndex}`
      const { winnerId, loserId } = eliminationPairingWinnerLoser(pairing)
      const resolved =
        pairing.playerBId === null || pairingIsResolved(pairing, format)
      if (!resolved && pairing.playerBId !== null) return
      if (winnerId) playerLastMatch.set(winnerId, key)
      if (loserId) playerLastMatch.set(loserId, key)
      if (pairing.playerBId === null) {
        playerLastMatch.set(pairing.playerAId, key)
      }
    })
  }

  return visuals
}

/** Graphe de tableau : coupe v3 utilise `elim.connectFrom`; legacy utilise le dernier match par joueur. */
export function eliminationBracketMatches(
  state: TournamentState,
): BracketMatchVisual[] {
  if ((state.format ?? 'swiss') !== 'elimination') return []

  if (eliminationIsLegacyState(state)) {
    return eliminationBracketMatchesLegacy(state)
  }

  const format = state.format ?? 'elimination'
  const maxRounds = Math.max(1, state.maxRounds)
  const b = bracketSize(state.players.length)
  const maxMainDepth = Math.max(0, Math.round(Math.log2(b)) - 1)

  const rounds = [...state.rounds].sort((a, b) => a.roundIndex - b.roundIndex)
  const visuals: BracketMatchVisual[] = []

  for (const rnd of rounds) {
    rnd.pairings.forEach((pairing, slotIndex) => {
      const e = pairing.elim
      if (!e?.key) return

      const resolved = pairingIsResolved(pairing, format)
      let { winnerId, loserId } = eliminationPairingWinnerLoser(pairing)
      if (!resolved && pairing.playerBId !== null) {
        winnerId = null
        loserId = null
      }

      const title =
        eliminationMatchTitleFr(e, maxMainDepth) ??
        eliminationPhaseLabelFr(rnd.roundIndex, maxRounds)

      visuals.push({
        key: e.key,
        roundIndex: rnd.roundIndex,
        slotIndex,
        playerAId: pairing.playerAId,
        playerBId: pairing.playerBId,
        incomingKeys: e.connectFrom ? [...e.connectFrom] : [null, null],
        winnerId,
        loserId,
        resolved,
        phaseShort: title,
        elimKind: e.kind,
        mainDepth: e.mainDepth,
        mainSlot: e.mainSlot,
        cohortMainDepth: e.cohortMainDepth,
        placementDepth: e.placementDepth,
        placementSlot: e.placementSlot,
        placementLane: e.placementLane,
      })
    })
  }

  return visuals
}

/** Nom affiché pour les lignes encore sans joueurs (coupe bronze fictifs). */
export const CUP_BRACKET_DISPLAY_PLACEHOLDER = '—'

/**
 * Complète la liste des matchs coupe principale (`main-{d}-{s}`) pour tout le tableau
 * (demi-finale, finale, …), même avant que les persistances existent dans l’état.
 */
export function withMainCupPlaceholders(
  visuals: BracketMatchVisual[],
  playerCount: number,
): BracketMatchVisual[] {
  const b = bracketSize(playerCount)
  const lb = Math.round(Math.log2(b))
  const maxD = Math.max(0, lb - 1)

  const rest = visuals.filter((v) => v.elimKind !== 'main')

  const byKey = new Map(
    visuals
      .filter((v) => v.elimKind === 'main')
      .map((m) => [m.key, m] as const),
  )

  const added: BracketMatchVisual[] = []
  for (let d = 0; d <= maxD; d++) {
    const nSlots = 2 ** (maxD - d)
    for (let s = 0; s < nSlots; s++) {
      const key = mainMatchKey(d, s)
      if (byKey.has(key)) continue
      added.push({
        key,
        roundIndex: 0,
        slotIndex: s,
        playerAId: CUP_BRACKET_DISPLAY_PLACEHOLDER,
        playerBId: CUP_BRACKET_DISPLAY_PLACEHOLDER,
        incomingKeys:
          d === 0 ?
            [null, null]
          : [mainMatchKey(d - 1, s * 2), mainMatchKey(d - 1, s * 2 + 1)],
        winnerId: null,
        loserId: null,
        resolved: false,
        phaseShort: '',
        elimKind: 'main',
        mainDepth: d,
        mainSlot: s,
      })
    }
  }

  return [...rest, ...byKey.values(), ...added]
}

/** Profondeur des demi-finales (feeder du bronze). */
function semiDepthFromBracketSize(b: number): number {
  const lb = Math.round(Math.log2(b))
  return lb - 2
}

/**
 * Coupe complète comme `withMainCupPlaceholders`, plus une case **petite finale**
 * (bronze) fictive reliée aux demi-finales, si le format la prévoit.
 */
export function withCupBracketDisplayPlaceholders(
  visuals: BracketMatchVisual[],
  playerCount: number,
): BracketMatchVisual[] {
  const merged = withMainCupPlaceholders(visuals, playerCount)
  const b = bracketSize(playerCount)
  const sd = semiDepthFromBracketSize(b)
  if (sd >= 0 && !merged.some((v) => v.elimKind === 'bronze')) {
    const bronze: BracketMatchVisual = {
      key: bronzeMatchKey(),
      roundIndex: 0,
      slotIndex: 0,
      playerAId: CUP_BRACKET_DISPLAY_PLACEHOLDER,
      playerBId: CUP_BRACKET_DISPLAY_PLACEHOLDER,
      incomingKeys: [mainMatchKey(sd, 0), mainMatchKey(sd, 1)],
      winnerId: null,
      loserId: null,
      resolved: false,
      phaseShort: '',
      elimKind: 'bronze',
    }
    return [...merged, bronze]
  }
  return merged
}

/** Indices de colonne gauche→droite pour les matchs placement d’une même cohorte. */
export function placementVisualColumnIndex(m: BracketMatchVisual): number {
  const d = m.placementDepth ?? 0
  const lanePri = m.placementLane === 'L' ? 1 : 0
  if (d === 0 && m.placementLane == null) return 0
  return d * 2 + lanePri
}

/** Repère coupe / petite finale / mini-tableaux (v3 uniquement — filtrer après `eliminationBracketMatches`). */
export function partitionEliminationBracketVisuals(
  visuals: BracketMatchVisual[],
): {
  main: BracketMatchVisual[]
  bronze: BracketMatchVisual[]
  placementsByCohort: Map<number, BracketMatchVisual[]>
} {
  const main: BracketMatchVisual[] = []
  const bronze: BracketMatchVisual[] = []
  const placementsByCohort = new Map<number, BracketMatchVisual[]>()
  const seen = new Map<string, BracketMatchVisual>()

  for (const m of visuals) {
    seen.set(m.key, m)
  }

  for (const m of seen.values()) {
    if (m.elimKind === 'main') {
      main.push(m)
      continue
    }
    if (m.elimKind === 'bronze') {
      bronze.push(m)
      continue
    }
    if (m.elimKind === 'placement') {
      const dm = m.cohortMainDepth
      if (typeof dm !== 'number') continue
      const list = placementsByCohort.get(dm) ?? []
      list.push(m)
      placementsByCohort.set(dm, list)
    }
  }

  return { main, bronze, placementsByCohort }
}

export type BracketMatchLaidOut = BracketMatchVisual & {
  layout: {
    lx: number
    ly: number
    boxW: number
    boxH: number
  }
}

export type LayoutBracketOpts = {
  colGap?: number
  rowStep?: number
  boxW?: number
  boxH?: number
  /**
   * Indices de colonnes gauche→droite (coupe complète, rondes legacy, etc.).
   * Remplit les colonnes vides pour garder une largeur SVG stable = échelle des cases inchangée
   * quand de nouvelles phases apparaissent.
   */
  columnOrder?: number[]
  /** Colonne physique gauche→droite (ex. roundIndex legacy, ou mainDepth pour la coupe). */
  columnOf: (m: BracketMatchVisual) => number
  /** Tri vertical dans une colonne. */
  rowKey?: (m: BracketMatchVisual) => number
  /** En-tête de colonne SVG (phase). */
  columnLabel?: (colKey: number) => string
}

export type LayoutBracketColumnHeader = {
  columnKey: number
  label: string
  xCenter: number
}

/**
 * Colonnes gauche→droite selon `columnOf`; hauteur = max du nombre de matchs par colonne (centrage pyramidale dans la coupe).
 */
export function layoutEliminationBracketByColumns(
  matches: BracketMatchVisual[],
  maxRounds: number,
  opts: LayoutBracketOpts,
): {
  laid: BracketMatchLaidOut[]
  svgW: number
  svgH: number
  columnPhases: LayoutBracketColumnHeader[]
} {
  const colGap = opts.colGap ?? 28
  const rowStep = opts.rowStep ?? 56
  const boxW = opts.boxW ?? 172
  const boxH = opts.boxH ?? 52
  const rowOf = opts.rowKey ?? ((m) => m.slotIndex)

  const colsFromMatches = [
    ...new Set(matches.map((m) => opts.columnOf(m))),
  ].sort((a, b) => a - b)

  /** Colonnes explicites + toute colonne où il existe encore un match (robustesse). */
  let columnOrder: number[]
  if (opts.columnOrder?.length) {
    columnOrder = [...opts.columnOrder]
    for (const c of colsFromMatches) {
      if (!columnOrder.includes(c)) columnOrder.push(c)
    }
    columnOrder.sort((a, b) => a - b)
  } else {
    columnOrder = colsFromMatches
  }

  const byCol = new Map<number, BracketMatchVisual[]>()
  for (const ck of columnOrder) {
    byCol.set(
      ck,
      matches
        .filter((m) => opts.columnOf(m) === ck)
        .sort((a, b) => rowOf(a) - rowOf(b)),
    )
  }
  const counts = columnOrder.map((r) => byCol.get(r)!.length)
  const gridRows = counts.length ? Math.max(0, ...counts) : 0
  const totalH =
    gridRows <= 0
      ? 120
      : Math.max(boxH + 72, gridRows * rowStep + 56 + (maxRounds > 3 ? 20 : 0))

  const px0 = colGap / 2 + 52
  const pxPerCol = boxW + colGap

  const laid: BracketMatchLaidOut[] = []

  columnOrder.forEach((ck, ci) => {
    const row = byCol.get(ck)!
    const colHOffset = Math.max(
      0,
      ((gridRows - row.length) * rowStep) / 2,
    )

    row.forEach((m, mj) => {
      const lx = px0 + ci * pxPerCol
      const ly = 52 + colHOffset + mj * rowStep
      laid.push({
        ...m,
        layout: { lx, ly, boxW, boxH },
      })
    })
  })

  const columnPhases: LayoutBracketColumnHeader[] = columnOrder.map(
    (ck, ci) => {
      const sample = laid.find((x) => opts.columnOf(x) === ck)
      const xCenter = sample ?
          sample.layout.lx + sample.layout.boxW / 2
        : px0 + ci * pxPerCol + boxW / 2
      const label = opts.columnLabel?.(ck) ?? sample?.phaseShort ?? ''
      return { columnKey: ck, label, xCenter }
    },
  )

  const svgW = px0 + columnOrder.length * pxPerCol + colGap
  const svgH = totalH
  return { laid, svgW, svgH, columnPhases }
}

/** Legacy / défaut : une colonne par `roundIndex` de sauvegarde. */
export function layoutEliminationBracket(
  matches: BracketMatchVisual[],
  maxRounds: number,
  opts?: {
    colGap?: number
    rowStep?: number
    boxW?: number
    boxH?: number
    /** Rondes 1 … maxRondes même si aucun match encore. */
    columnOrder?: number[]
  },
): {
  laid: BracketMatchLaidOut[]
  svgW: number
  svgH: number
  columnPhases: LayoutBracketColumnHeader[]
} {
  return layoutEliminationBracketByColumns(matches, maxRounds, {
    ...opts,
    columnOf: (m) => m.roundIndex,
    rowKey: (m) => m.slotIndex,
    columnLabel: (ri) =>
      matches.find((x) => x.roundIndex === ri)?.phaseShort ?? '',
  })
}

export type OrthogonalConnectorStyle = 'midpoint' | 'nearParent'

/** Décalage horizontal du coude quand plusieurs arêtes sortent du même match (placement W+L). */
export type OrthogonalConnectorOpts = {
  style?: OrthogonalConnectorStyle
  /** Ajout au `mid` X après calcul (pour séparer deux traits identiques au départ). */
  midXBias?: number
}

/**
 * Parent à gauche, enfant à droite — coude orthogonal.
 * `midpoint` : style coupe principale historique ; `nearParent` : évite une verticale
 * trop au centre qui traverse la colonne intermédiaire (mini-tableaux placement).
 */
export function orthogonalConnector(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts?: OrthogonalConnectorOpts,
): string {
  const style: OrthogonalConnectorStyle = opts?.style ?? 'midpoint'
  const bias = opts?.midXBias ?? 0
  const dx = x2 - x1
  if (dx <= 1) return `M ${x1} ${y1} L ${x2} ${y2}`

  let mid: number
  if (style === 'midpoint') {
    mid = x1 + dx / 2 + bias
  } else {
    const stub = Math.min(44, Math.max(10, dx * 0.11))
    mid = Math.min(x1 + stub, x2 - 8)
    mid = Math.max(mid, x1 + 6)
    if (mid >= x2 - 1) mid = x1 + dx / 2
    mid += bias
  }

  mid = Math.min(Math.max(mid, x1 + 4), x2 - 4)
  return `M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`
}
