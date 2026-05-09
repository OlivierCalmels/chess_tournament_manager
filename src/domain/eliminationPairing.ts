import type {
  EliminationPairingMeta,
  Pairing,
  TournamentFormat,
  TournamentState,
} from './types'
import { pairingIsResolved } from './scoring'

/** Plus petite puissance de 2 ≥ n (pour tableau avec exempts). */
export function bracketSize(n: number): number {
  if (n <= 0) return 1
  let b = 1
  while (b < n) b <<= 1
  return b
}

/** Nombre de « vagues » (rondes validées), = log2(taille tableau). */
export function eliminationMaxRounds(playerCount: number): number {
  const b = bracketSize(playerCount)
  return Math.round(Math.log2(b))
}

function logBOf(bracketSz: number): number {
  return Math.round(Math.log2(bracketSz))
}

/** Feuilles : seed 1..B canonique (coupe NCAA), ex. [1,8,4,5,2,7,3,6] pour B=8. */
export function standardLeafSeedOrder(b: number): number[] {
  if (b <= 1) return [1]
  const half = b / 2
  const prev = standardLeafSeedOrder(half)
  const out: number[] = []
  for (const s of prev) {
    out.push(s)
    out.push(b + 1 - s)
  }
  return out
}

/**
 * Ordre vertical type Wikipédia des matchs du 1er tour (indices de demi-tableau 0..B/2-1).
 */
export function wikiMatchSlotOrder(slotCount: number): number[] {
  if (slotCount <= 1) return [0]
  const h = slotCount / 2
  const top = wikiMatchSlotOrder(h)
  const bot = wikiMatchSlotOrder(h).map((i) => i + h)
  return [...top, ...bot.reverse()]
}

export function mainMatchKey(depth: number, slot: number): string {
  return `main-${depth}-${slot}`
}

export function bronzeMatchKey(): string {
  return 'bronze-0'
}

/** 1ère ronde du mini-tableau (feuilles), slot canonique du bracket placement. */
export function placementBaseMatchKey(
  cohortMainDepth: number,
  slot: number,
): string {
  return `pl-m${cohortMainDepth}-t0-s${slot}`
}

/** Niveaux placement > 0 : arbres vainqueurs (W) et perdants (L) parallèles. */
export function placementWLMatchKey(
  cohortMainDepth: number,
  lane: 'W' | 'L',
  tier: number,
  slot: number,
): string {
  return `pl-m${cohortMainDepth}-${lane}${tier}-${slot}`
}

type PlannedPlDual = {
  key: string
  cohortMainDepth: number
  lane: 'W' | 'L'
  tier: number
  slot: number
  feederA: { key: string; take: 'winner' | 'loser' }
  feederB: { key: string; take: 'winner' | 'loser' }
}

/** Par slot d’arbre placement (t0), indique si le match produit un perdant réel (pas exempt). */
function placementTier0LoserFlags(losersSorted: string[]): boolean[] {
  const n = losersSorted.length
  const Bp = bracketSize(n)
  const leafSeedNums = standardLeafSeedOrder(Bp)
  const flags: boolean[] = []
  for (let slot = 0; slot < Bp / 2; slot++) {
    const leafA = slot * 2
    const leafB = slot * 2 + 1
    const srA = leafSeedNums[leafA]
    const srB = leafSeedNums[leafB]
    const pidA =
      srA <= n ?
        losersSorted[srA - 1]
      : null
    const pidB =
      srB <= n ?
        losersSorted[srB - 1]
      : null
    flags.push(pidA !== null && pidB !== null)
  }
  return flags
}

function enumerateDualPlacementMatches(
  cohortMainDepth: number,
  tier0SlotHasLoser: boolean[],
): PlannedPlDual[] {
  const leafCount = tier0SlotHasLoser.length
  if (leafCount < 2) return []

  const frontier0 = Array.from({ length: leafCount }, (_, s) =>
    placementBaseMatchKey(cohortMainDepth, s),
  )

  const producesLoser = new Map<string, boolean>()
  for (let s = 0; s < leafCount; s++) {
    producesLoser.set(frontier0[s]!, tier0SlotHasLoser[s] ?? false)
  }

  const out: PlannedPlDual[] = []

  function walk(frontier: string[], tier: number) {
    if (frontier.length < 2) return
    const nextW: string[] = []
    const nextL: string[] = []
    for (let i = 0; i < frontier.length; i += 2) {
      const ka = frontier[i]!
      const kb = frontier[i + 1]!
      const sw = placementWLMatchKey(cohortMainDepth, 'W', tier, i / 2)
      out.push({
        key: sw,
        cohortMainDepth,
        lane: 'W',
        tier,
        slot: i / 2,
        feederA: { key: ka, take: 'winner' },
        feederB: { key: kb, take: 'winner' },
      })
      producesLoser.set(sw, true)

      const canL =
        (producesLoser.get(ka) ?? false) && (producesLoser.get(kb) ?? false)
      if (canL) {
        const sl = placementWLMatchKey(cohortMainDepth, 'L', tier, i / 2)
        out.push({
          key: sl,
          cohortMainDepth,
          lane: 'L',
          tier,
          slot: i / 2,
          feederA: { key: ka, take: 'loser' },
          feederB: { key: kb, take: 'loser' },
        })
        producesLoser.set(sl, true)
        nextL.push(sl)
      }

      nextW.push(sw)
    }
    walk(nextW, tier + 1)
    walk(nextL, tier + 1)
  }

  walk(frontier0, 1)
  return out
}

function resolvePlFeed(
  oc: OutcomeMaps,
  f: { key: string; take: 'winner' | 'loser' },
): string | null {
  return f.take === 'winner'
    ? (oc.winner.get(f.key) ?? null)
    : (oc.loser.get(f.key) ?? null)
}

function tryPlannedDualPair(
  spec: PlannedPlDual,
  oc: OutcomeMaps,
): Pairing | null {
  if (oc.played.has(spec.key)) return null
  if (!oc.played.has(spec.feederA.key) || !oc.played.has(spec.feederB.key))
    return null

  const needsLoser =
    spec.feederA.take === 'loser' || spec.feederB.take === 'loser'
  const fk0 = resolvePlFeed(oc, spec.feederA)
  const fk1 = resolvePlFeed(oc, spec.feederB)
  if (needsLoser && (fk0 === null || fk1 === null)) return null

  const elimMeta: EliminationPairingMeta = {
    kind: 'placement',
    key: spec.key,
    cohortMainDepth: spec.cohortMainDepth,
    placementDepth: spec.tier,
    placementSlot: spec.slot,
    placementLane: spec.lane,
    connectFrom: [spec.feederA.key, spec.feederB.key],
  }

  if (fk0 !== null && fk1 !== null) {
    return pairingWithElim(
      { playerAId: fk0, playerBId: fk1, result: null },
      elimMeta,
    )
  }
  if (fk0 !== null && fk1 === null) {
    return pairingWithElim(
      { playerAId: fk0, playerBId: null, result: 'A' },
      elimMeta,
    )
  }
  if (fk0 === null && fk1 !== null) {
    return pairingWithElim(
      { playerAId: fk1, playerBId: null, result: 'A' },
      elimMeta,
    )
  }
  return null
}

export function eliminationSeedIds(state: TournamentState): string[] {
  if (state.eliminationRound1Order?.length === state.players.length) {
    return [...state.eliminationRound1Order]
  }
  return [...state.players]
    .sort((a, b) => b.elo - a.elo)
    .map((p) => p.id)
}

/** Tournoi élimination sans métadonnées `elim` (ancien moteur). */
export function eliminationIsLegacyState(state: TournamentState): boolean {
  if ((state.format ?? 'swiss') !== 'elimination') return false
  if (state.eliminationLegacy) return true
  const hasRounds = state.rounds.some((r) => r.pairings.length > 0)
  if (!hasRounds) return false
  return state.rounds.some((r) =>
    r.pairings.some((p) => (p.playerBId === null || p.playerBId) && !p.elim),
  )
}

function winnerAndLoser(
  p: Pairing,
): { winner: string | null; loser: string | null } {
  if (p.playerBId === null) {
    return { winner: p.playerAId, loser: null }
  }
  let win: string | null = null
  let lose: string | null = null
  if (p.result === 'A') {
    win = p.playerAId
    lose = p.playerBId
  } else if (p.result === 'B') {
    win = p.playerBId
    lose = p.playerAId
  } else if (p.result === 'draw') {
    if (p.tieBreakResult === 'A') {
      win = p.playerAId
      lose = p.playerBId
    } else if (p.tieBreakResult === 'B') {
      win = p.playerBId
      lose = p.playerAId
    }
  }
  return { winner: win, loser: lose }
}

export function eliminationPairingWinnerLoser(p: Pairing): {
  winnerId: string | null
  loserId: string | null
} {
  const { winner, loser } = winnerAndLoser(p)
  return { winnerId: winner, loserId: loser }
}

type OutcomeMaps = {
  winner: Map<string, string>
  loser: Map<string, string>
  played: Set<string>
}

function collectOutcomes(state: TournamentState): OutcomeMaps {
  const format: TournamentFormat = state.format ?? 'swiss'
  const winner = new Map<string, string>()
  const loser = new Map<string, string>()
  const played = new Set<string>()
  for (const r of state.rounds) {
    if (!r.completed) continue
    for (const p of r.pairings) {
      const k = p.elim?.key
      if (!k) continue
      if (!pairingIsResolved(p, format)) continue
      const { winnerId, loserId } = eliminationPairingWinnerLoser(p)
      if (winnerId) winner.set(k, winnerId)
      if (loserId) loser.set(k, loserId)
      played.add(k)
    }
  }
  return { winner, loser, played }
}

function seedRankByPlayerId(state: TournamentState): Map<string, number> {
  const order = eliminationSeedIds(state)
  const m = new Map<string, number>()
  order.forEach((id, i) => m.set(id, i + 1))
  return m
}

function sortBySeedRank(
  ids: string[],
  rank: Map<string, number>,
): string[] {
  return [...ids].sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999))
}

function mainSlotsAtDepth(b: number, depth: number): number {
  return b / 2 ** (depth + 1)
}

function semiDepth(b: number): number {
  const lb = logBOf(b)
  return lb - 2
}

/** Indices de cohortes placement : perdants du main à la profondeur d (sans la demi-finale coupe). */
export function cohortMainDepthsForPlacement(b: number): number[] {
  const lb = logBOf(b)
  const semi = lb - 2
  if (semi < 0) return []
  const out: number[] = []
  for (let d = 0; d <= semi - 1; d++) out.push(d)
  return out
}

function pairingWithElim(
  p: Omit<Pairing, 'elim'>,
  elim: EliminationPairingMeta,
): Pairing {
  return { ...p, elim }
}

/** 1er tour : feuilles + ordre wiki + exempts aux meilleurs seeds. */
export function buildEliminationRoundOnePairings(state: TournamentState): Pairing[] {
  const seeds = eliminationSeedIds(state)
  const n = seeds.length
  const B = bracketSize(n)
  const leafSeedNums = standardLeafSeedOrder(B)
  const wiki = wikiMatchSlotOrder(B / 2)
  const pairings: Pairing[] = []

  for (const slot of wiki) {
    const leafA = slot * 2
    const leafB = slot * 2 + 1
    const srA = leafSeedNums[leafA]
    const srB = leafSeedNums[leafB]
    const pidA =
      srA <= n ?
        seeds[srA - 1]
      : null
    const pidB =
      srB <= n ?
        seeds[srB - 1]
      : null
    const key = mainMatchKey(0, slot)

    if (pidA !== null && pidB !== null) {
      pairings.push(
        pairingWithElim(
          {
            playerAId: pidA,
            playerBId: pidB,
            result: null,
          },
          {
            kind: 'main',
            key,
            mainDepth: 0,
            mainSlot: slot,
            connectFrom: [null, null],
          },
        ),
      )
    } else if (pidA !== null && pidB === null) {
      pairings.push(
        pairingWithElim(
          {
            playerAId: pidA,
            playerBId: null,
            result: 'A',
          },
          {
            kind: 'main',
            key,
            mainDepth: 0,
            mainSlot: slot,
            connectFrom: [null, null],
          },
        ),
      )
    } else if (pidA === null && pidB !== null) {
      pairings.push(
        pairingWithElim(
          {
            playerAId: pidB,
            playerBId: null,
            result: 'A',
          },
          {
            kind: 'main',
            key,
            mainDepth: 0,
            mainSlot: slot,
            connectFrom: [null, null],
          },
        ),
      )
    }
  }

  return pairings
}

function feedersReady(
  oc: OutcomeMaps,
  d: number,
  s: number,
): [string | null, string | null] | null {
  if (d === 0) return null
  const k0 = mainMatchKey(d - 1, s * 2)
  const k1 = mainMatchKey(d - 1, s * 2 + 1)
  if (!oc.played.has(k0) || !oc.played.has(k1)) return null
  return [oc.winner.get(k0) ?? null, oc.winner.get(k1) ?? null]
}

function tryMainPair(
  d: number,
  s: number,
  oc: OutcomeMaps,
): Pairing | null {
  const key = mainMatchKey(d, s)
  if (oc.played.has(key)) return null

  if (d === 0) return null

  const fed = feedersReady(oc, d, s)
  if (!fed) return null
  const [wa, wb] = fed

  const elimBase: EliminationPairingMeta = {
    kind: 'main',
    key,
    mainDepth: d,
    mainSlot: s,
    connectFrom: [mainMatchKey(d - 1, s * 2), mainMatchKey(d - 1, s * 2 + 1)],
  }

  if (wa !== null && wb !== null) {
    return pairingWithElim(
      { playerAId: wa, playerBId: wb, result: null },
      elimBase,
    )
  }
  if (wa !== null && wb === null) {
    return pairingWithElim(
      { playerAId: wa, playerBId: null, result: 'A' },
      elimBase,
    )
  }
  if (wa === null && wb !== null) {
    return pairingWithElim(
      { playerAId: wb, playerBId: null, result: 'A' },
      elimBase,
    )
  }
  return null
}

function tryBronzePair(b: number, oc: OutcomeMaps): Pairing | null {
  const lb = logBOf(b)
  if (lb < 2) return null
  const sd = semiDepth(b)
  const k0 = mainMatchKey(sd, 0)
  const k1 = mainMatchKey(sd, 1)
  const bk = bronzeMatchKey()
  if (!oc.played.has(k0) || !oc.played.has(k1)) return null
  if (oc.played.has(bk)) return null

  const l0 = oc.loser.get(k0)
  const l1 = oc.loser.get(k1)
  if (!l0 || !l1) return null

  return pairingWithElim(
    {
      playerAId: l0,
      playerBId: l1,
      result: null,
    },
    {
      kind: 'bronze',
      key: bk,
      connectFrom: [k0, k1],
    },
  )
}

function tryFinalPair(b: number, oc: OutcomeMaps): Pairing | null {
  const lb = logBOf(b)
  const fd = lb - 1
  const fk = mainMatchKey(fd, 0)
  if (oc.played.has(fk)) return null
  const fed = feedersReady(oc, fd, 0)
  if (!fed) return null
  const [wa, wb] = fed
  const fk0 = mainMatchKey(fd - 1, 0)
  const fk1 = mainMatchKey(fd - 1, 1)
  const elimBase: EliminationPairingMeta = {
    kind: 'main',
    key: fk,
    mainDepth: fd,
    mainSlot: 0,
    connectFrom: [fk0, fk1],
  }
  if (wa !== null && wb !== null) {
    return pairingWithElim(
      { playerAId: wa, playerBId: wb, result: null },
      elimBase,
    )
  }
  if (wa !== null && wb === null) {
    return pairingWithElim(
      { playerAId: wa, playerBId: null, result: 'A' },
      elimBase,
    )
  }
  if (wa === null && wb !== null) {
    return pairingWithElim(
      { playerAId: wb, playerBId: null, result: 'A' },
      elimBase,
    )
  }
  return null
}

/** Perdants du main à la profondeur d, ordre des slots croissant. */
function mainLosersAtDepth(
  b: number,
  d: number,
  oc: OutcomeMaps,
): string[] | null {
  const slots = mainSlotsAtDepth(b, d)
  const out: string[] = []
  for (let s = 0; s < slots; s++) {
    const k = mainMatchKey(d, s)
    if (!oc.played.has(k)) return null
    const lo = oc.loser.get(k)
    /** Exempt : pas de perdant réel dans la cohort placement. */
    if (lo) out.push(lo)
  }
  return out
}

function buildPlacementRoundZero(
  cohortMainDepth: number,
  losersSorted: string[],
  oc: OutcomeMaps,
): Pairing[] {
  const n = losersSorted.length
  const Bp = bracketSize(n)
  const leafSeedNums = standardLeafSeedOrder(Bp)
  const pairings: Pairing[] = []
  const seeds = losersSorted

  for (let slot = 0; slot < Bp / 2; slot++) {
    const leafA = slot * 2
    const leafB = slot * 2 + 1
    const srA = leafSeedNums[leafA]
    const srB = leafSeedNums[leafB]
    const pidA =
      srA <= n ?
        seeds[srA - 1]
      : null
    const pidB =
      srB <= n ?
        seeds[srB - 1]
      : null
    const key = placementBaseMatchKey(cohortMainDepth, slot)

    if (oc.played.has(key)) continue

    if (pidA !== null && pidB !== null) {
      pairings.push(
        pairingWithElim(
          { playerAId: pidA, playerBId: pidB, result: null },
          {
            kind: 'placement',
            key,
            cohortMainDepth,
            placementDepth: 0,
            placementSlot: slot,
          },
        ),
      )
    } else if (pidA !== null && pidB === null) {
      pairings.push(
        pairingWithElim(
          { playerAId: pidA, playerBId: null, result: 'A' },
          {
            kind: 'placement',
            key,
            cohortMainDepth,
            placementDepth: 0,
            placementSlot: slot,
          },
        ),
      )
    } else if (pidA === null && pidB !== null) {
      pairings.push(
        pairingWithElim(
          { playerAId: pidB, playerBId: null, result: 'A' },
          {
            kind: 'placement',
            key,
            cohortMainDepth,
            placementDepth: 0,
            placementSlot: slot,
          },
        ),
      )
    }
  }

  return pairings
}

function collectPlacementPairings(
  state: TournamentState,
  b: number,
  oc: OutcomeMaps,
): Pairing[] {
  const out: Pairing[] = []
  const cohorts = cohortMainDepthsForPlacement(b)
  const rank = seedRankByPlayerId(state)

  for (const dm of cohorts) {
    const losers = mainLosersAtDepth(b, dm, oc)
    if (!losers || losers.length < 2) continue
    const sorted = sortBySeedRank(losers, rank)
    const loserFlags = placementTier0LoserFlags(sorted)

    for (const p of buildPlacementRoundZero(dm, sorted, oc)) out.push(p)

    for (const spec of enumerateDualPlacementMatches(dm, loserFlags)) {
      const cand = tryPlannedDualPair(spec, oc)
      if (cand) out.push(cand)
    }
  }
  return out
}

/**
 * Paires pour la vague suivante (après validation de la vague courante complète).
 */
export function nextEliminationRoundPairings(
  state: TournamentState,
): Pairing[] {
  if ((state.format ?? 'swiss') !== 'elimination') return []
  if (eliminationIsLegacyState(state)) return []

  const n = state.players.length
  const b = bracketSize(n)
  const lb = logBOf(b)

  const oc = collectOutcomes(state)

  const out: Pairing[] = []

  /** Profondeurs 1 .. lb-2 : tours intermédiaires. La finale (d = lb-1) passe par tryFinalPair pour éviter de la doubler avec le dernier tryMainPair du même coup. */
  for (let d = 1; d <= lb - 2; d++) {
    const slots = mainSlotsAtDepth(b, d)
    for (let s = 0; s < slots; s++) {
      const cand = tryMainPair(d, s, oc)
      if (cand) out.push(cand)
    }
  }

  /** Finale + petite finale même vague (toujours émettre la finale avant bronze pour stabilité) */
  const finalP = tryFinalPair(b, oc)
  if (finalP) out.push(finalP)
  const bronzeP = tryBronzePair(b, oc)
  if (bronzeP) out.push(bronzeP)

  out.push(...collectPlacementPairings(state, b, oc))
  return out
}

/** Vrai si tableau + petite finales + placements terminés (moteur v3). */
export function eliminationBracketComplete(state: TournamentState): boolean {
  if ((state.format ?? 'swiss') !== 'elimination') return true
  if (eliminationIsLegacyState(state)) return state.finished

  const n = state.players.length
  const b = bracketSize(n)
  const lb = logBOf(b)
  const oc = collectOutcomes(state)

  const fk = mainMatchKey(lb - 1, 0)
  if (!oc.played.has(fk)) return false

  if (lb >= 2) {
    const bk = bronzeMatchKey()
    if (!oc.played.has(bk)) return false
  }

  const rank = seedRankByPlayerId(state)
  for (const dm of cohortMainDepthsForPlacement(b)) {
    const lovers = mainLosersAtDepth(b, dm, oc)
    if (!lovers || lovers.length < 2) continue
    const sorted = sortBySeedRank(lovers, rank)
    const loserFlags = placementTier0LoserFlags(sorted)
    for (let s = 0; s < loserFlags.length; s++) {
      if (!oc.played.has(placementBaseMatchKey(dm, s))) return false
    }
    for (const spec of enumerateDualPlacementMatches(dm, loserFlags)) {
      if (!oc.played.has(spec.key)) return false
    }
  }

  return true
}

/** Libellé phase « coupe » selon vague (colonnes tableau principal seulement, approximatif). */
export function eliminationPhaseLabelFr(
  roundIndex: number,
  maxRounds: number,
): string {
  const r = Math.floor(roundIndex)
  const m = Math.max(1, Math.floor(maxRounds))
  if (r < 1 || r > m) return `Ronde ${roundIndex}`
  const fromFinal = m - r
  const names = [
    'Finale',
    'Demi-finale',
    'Quart de finale',
    'Huitième de finale',
    'Seizième de finale',
    'Trente-deuxième de finale',
  ] as const
  if (fromFinal < names.length) return names[fromFinal]!
  return `Ronde ${r} / ${m}`
}

export function eliminationRoundColumnLabel(
  roundIndex: number,
  maxRounds: number,
): string {
  return eliminationPhaseLabelFr(roundIndex, maxRounds)
}

/** Titre FR par match selon métadonnées (UI). */
export function eliminationMatchTitleFr(
  meta: EliminationPairingMeta | undefined,
  maxMainDepth: number,
): string | null {
  if (!meta) return null
  if (meta.kind === 'bronze') return 'Match 3ᵉ place'
  if (
    meta.kind === 'main' &&
    typeof meta.mainDepth === 'number'
  ) {
    if (meta.mainDepth >= maxMainDepth) return 'Finale'
    return eliminationPhaseLabelFr(meta.mainDepth + 1, maxMainDepth + 1)
  }
  if (meta.kind === 'placement') {
    if (meta.placementLane === 'W') return 'Classement (vainqueurs)'
    if (meta.placementLane === 'L') return 'Classement (perdants)'
    return 'Classement'
  }
  return null
}

export type EliminationStandingRow = {
  playerId: string
  rank: number
}

/**
 * Classement final 1..N (bronze et mini-tableaux). Les perdants « sans résultats » restent derniers ex-aequo.
 */
export function computeEliminationStandings(
  state: TournamentState,
): EliminationStandingRow[] {
  if ((state.format ?? 'swiss') !== 'elimination') {
    return state.players.map((p, i) => ({ playerId: p.id, rank: i + 1 }))
  }
  const n = state.players.length
  if (eliminationIsLegacyState(state)) {
    return [...state.players]
      .map((p) => ({
        playerId: p.id,
        score: state.rounds.reduce(
          (acc, r) =>
            acc +
            (r.completed ?
              (
                r.pairings.filter(
                  (x) =>
                    pairingIsResolved(x, 'elimination') &&
                    eliminationPairingWinnerLoser(x).winnerId === p.id,
                ).length
              )
            : 0),
          0,
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .map((x, idx) => ({ playerId: x.playerId, rank: idx + 1 }))
  }

  const b = bracketSize(n)
  const lb = logBOf(b)
  const oc = collectOutcomes(state)
  const rankMap = seedRankByPlayerId(state)

  const assigned = new Map<string, number>()

  const fk = mainMatchKey(lb - 1, 0)
  if (oc.played.has(fk)) {
    const w = oc.winner.get(fk)
    const ll = oc.loser.get(fk)
    if (w) assigned.set(w, 1)
    if (ll) assigned.set(ll, 2)
  }

  if (lb >= 2) {
    const bk = bronzeMatchKey()
    if (oc.played.has(bk)) {
      const w = oc.winner.get(bk)
      const ll = oc.loser.get(bk)
      if (w) assigned.set(w, 3)
      if (ll) assigned.set(ll, 4)
    }
  }

  let nextRank =
    assigned.size ?
      Math.max(...assigned.values()) + 1
    : 1

  /** Cohortes avec dm plus grand = sortis plus tard dans le tableau principal : meilleurs rangs hors podium. */
  const cohortDESC = [...cohortMainDepthsForPlacement(b)].sort((x, y) => y - x)

  type PlEv = {
    tier: number
    lanePri: number
    key: string
  }

  for (const dm of cohortDESC) {
    const lovers = mainLosersAtDepth(b, dm, oc)
    if (!lovers || lovers.length < 2) continue
    const sortedLosers = sortBySeedRank(lovers, rankMap)
    const loserFlags = placementTier0LoserFlags(sortedLosers)

    const events: PlEv[] = []

    const dual = enumerateDualPlacementMatches(dm, loserFlags)
    for (const sp of dual) {
      events.push({
        tier: sp.tier,
        lanePri: sp.lane === 'W' ? 0 : 1,
        key: sp.key,
      })
    }
    for (let s = 0; s < loserFlags.length; s++) {
      events.push({ tier: 0, lanePri: 2, key: placementBaseMatchKey(dm, s) })
    }

    events.sort((x, y) => {
      if (y.tier !== x.tier) return y.tier - x.tier
      if (x.lanePri !== y.lanePri) return x.lanePri - y.lanePri
      return x.key.localeCompare(y.key)
    })

    for (const ev of events) {
      if (!oc.played.has(ev.key)) continue
      const w = oc.winner.get(ev.key)
      const lo = oc.loser.get(ev.key)
      if (w && !assigned.has(w)) assigned.set(w, nextRank++)
      if (lo && !assigned.has(lo)) assigned.set(lo, nextRank++)
    }
  }

  for (const p of state.players) {
    if (!assigned.has(p.id)) assigned.set(p.id, nextRank)
  }

  const rows = [...state.players].sort(
    (a, b) => (assigned.get(a.id) ?? 9e9) - (assigned.get(b.id) ?? 9e9),
  )
  return rows.map((p, idx) => ({ playerId: p.id, rank: idx + 1 }))
}
