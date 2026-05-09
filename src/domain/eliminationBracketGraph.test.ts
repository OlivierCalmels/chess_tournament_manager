import { describe, expect, it } from 'vitest'
import {
  eliminationBracketMatches,
  layoutEliminationBracketByColumns,
  partitionEliminationBracketVisuals,
  placementVisualColumnIndex,
  withCupBracketDisplayPlaceholders,
  withMainCupPlaceholders,
  type BracketMatchVisual,
} from './eliminationBracketGraph'
import { mainMatchKey } from './eliminationPairing'
import type { Player, TournamentState } from './types'

function p(id: string, elo: number): Player {
  return { id, name: id, elo }
}

describe('eliminationBracketMatches', () => {
  it('rattache une demi-finale aux quarts précédents (8 joueurs simulés)', () => {
    const players = [
      p('a', 80),
      p('b', 70),
      p('c', 60),
      p('d', 50),
      p('e', 40),
      p('f', 30),
      p('g', 20),
      p('h', 10),
    ]
    const st: TournamentState = {
      schemaVersion: 2,
      tournamentId: 'test',
      tournamentName: '',
      createdAt: new Date().toISOString(),
      maxRounds: 3,
      format: 'elimination',
      elimFirstRound: 'elo',
      eliminationRound1Order: players.map((x) => x.id),
      players,
      activeRoundIndex: 2,
      finished: false,
      rounds: [
        {
          roundIndex: 1,
          completed: true,
          pairings: [
            { playerAId: 'a', playerBId: 'h', result: 'A' },
            { playerAId: 'b', playerBId: 'g', result: 'A' },
            { playerAId: 'c', playerBId: 'f', result: 'A' },
            { playerAId: 'd', playerBId: 'e', result: 'A' },
          ],
        },
        {
          roundIndex: 2,
          completed: false,
          pairings: [
            { playerAId: 'a', playerBId: 'd', result: null },
            { playerAId: 'b', playerBId: 'c', result: null },
            { playerAId: 'e', playerBId: 'h', result: null },
            { playerAId: 'f', playerBId: 'g', result: null },
          ],
        },
      ],
    }

    const m = eliminationBracketMatches(st)
    const r2m0 = m.find((x) => x.roundIndex === 2 && x.slotIndex === 0)!
    expect(r2m0.incomingKeys[0]).toBe('r1-m0')
    expect(r2m0.incomingKeys[1]).toBe('r1-m3')
  })
})

function baseVisual(k: string, extras: Partial<BracketMatchVisual> = {}): BracketMatchVisual {
  return {
    key: k,
    roundIndex: 3,
    slotIndex: 0,
    playerAId: 'a',
    playerBId: 'b',
    incomingKeys: [null, null],
    winnerId: null,
    loserId: null,
    resolved: false,
    phaseShort: '',
    ...extras,
  }
}

describe('partitionEliminationBracketVisuals & layout coupe (schéma 3)', () => {
  it('sépare coupe, bronze et cohortes placement', () => {
    const visuals: BracketMatchVisual[] = [
      baseVisual('main-2-0', {
        elimKind: 'main',
        mainDepth: 2,
        mainSlot: 0,
      }),
      baseVisual('bronze-0', { elimKind: 'bronze' }),
      baseVisual('pl-m0-t0-s0', {
        elimKind: 'placement',
        cohortMainDepth: 0,
      }),
      baseVisual('pl-m1-t0-s0', {
        elimKind: 'placement',
        cohortMainDepth: 1,
      }),
    ]
    const { main, bronze, placementsByCohort } =
      partitionEliminationBracketVisuals(visuals)
    expect(main).toHaveLength(1)
    expect(main[0]?.key).toBe('main-2-0')
    expect(bronze).toHaveLength(1)
    expect(placementsByCohort.size).toBe(2)
    expect(placementsByCohort.get(0)?.length).toBe(1)
    expect(placementsByCohort.get(1)?.length).toBe(1)
  })

  it('colonnes coupe ordonnées par mainDepth gauche→droite', () => {
    const matches: BracketMatchVisual[] = [
      baseVisual('main-1-1', {
        elimKind: 'main',
        mainDepth: 1,
        mainSlot: 1,
      }),
      baseVisual('main-0-0', {
        elimKind: 'main',
        mainDepth: 0,
        mainSlot: 0,
        roundIndex: 1,
      }),
      baseVisual('main-1-0', {
        elimKind: 'main',
        mainDepth: 1,
        mainSlot: 0,
      }),
      baseVisual('main-2-0', {
        elimKind: 'main',
        mainDepth: 2,
        mainSlot: 0,
        roundIndex: 3,
      }),
    ]

    const { laid } = layoutEliminationBracketByColumns(matches, 3, {
      columnOf: (m) =>
        typeof m.mainDepth === 'number' ? m.mainDepth : 0,
      rowKey: (m) => m.mainSlot ?? 0,
      columnLabel: (d) => `d=${d}`,
    })

    const byKey = Object.fromEntries(
      laid.map((m) => [m.key, m.layout.lx] as const),
    )
    const colAvg = [
      Math.min(byKey['main-0-0']!),
      Math.min(byKey['main-1-0']!, byKey['main-1-1']!),
      byKey['main-2-0']!,
    ]
    expect(colAvg[0]).toBeLessThan(colAvg[1]!)
    expect(colAvg[1]).toBeLessThan(colAvg[2]!)
  })

  it('withMainCupPlaceholders : coupe 8 — QF présents, demi-finale + finale ajoutés', () => {
    const qf = [0, 1, 2, 3].map((slot) =>
      baseVisual(mainMatchKey(0, slot), {
        elimKind: 'main',
        mainDepth: 0,
        mainSlot: slot,
        playerAId: 'p1',
        playerBId: 'p2',
      }),
    )
    const merged = withMainCupPlaceholders(qf, 8)
    const mains = merged.filter((m) => m.elimKind === 'main')
    expect(mains).toHaveLength(7)
    expect(merged.find((m) => m.key === mainMatchKey(1, 0))).toBeDefined()
    expect(merged.find((m) => m.key === mainMatchKey(1, 1))).toBeDefined()
    expect(merged.find((m) => m.key === mainMatchKey(2, 0))).toBeDefined()
  })

  it('withCupBracketDisplayPlaceholders : ajoute bronze si absent (8 joueurs)', () => {
    const qf = [0, 1, 2, 3].map((slot) =>
      baseVisual(mainMatchKey(0, slot), {
        elimKind: 'main',
        mainDepth: 0,
        mainSlot: slot,
        playerAId: 'a',
        playerBId: 'b',
      }),
    )
    const merged = withCupBracketDisplayPlaceholders(qf, 8)
    expect(merged.some((m) => m.elimKind === 'bronze')).toBe(true)
    const br = merged.find((m) => m.elimKind === 'bronze')
    expect(br?.incomingKeys?.[0]).toBe(mainMatchKey(1, 0))
    expect(br?.incomingKeys?.[1]).toBe(mainMatchKey(1, 1))
  })

  it('columnOrder réservées : même matchs, svgW reflète déjà tout le tableau', () => {
    const sole = baseVisual('main-0-only', {
      elimKind: 'main',
      mainDepth: 0,
      mainSlot: 0,
      roundIndex: 1,
    })
    const baseOpts = {
      columnOf: (m: BracketMatchVisual) => m.mainDepth ?? 0,
      rowKey: (m: BracketMatchVisual) => m.mainSlot ?? 0,
      columnLabel: (d: number) => `d=${d}`,
    }
    const { svgW: wColsSeules } = layoutEliminationBracketByColumns(
      [sole],
      3,
      baseOpts,
    )
    const { svgW: wCoupeComplète } = layoutEliminationBracketByColumns(
      [sole],
      3,
      { ...baseOpts, columnOrder: [0, 1, 2] },
    )
    expect(wCoupeComplète).toBeGreaterThan(wColsSeules)
  })

  it('placementVisualColumnIndex : t0 puis W/L par étage', () => {
    expect(
      placementVisualColumnIndex(baseVisual('', { placementDepth: 0 })),
    ).toBe(0)
    expect(
      placementVisualColumnIndex(
        baseVisual('', { placementDepth: 1, placementLane: 'W' }),
      ),
    ).toBe(2)
    expect(
      placementVisualColumnIndex(
        baseVisual('', { placementDepth: 1, placementLane: 'L' }),
      ),
    ).toBe(3)
  })

  it('copie elimKind depuis state v3 avec elim sur les paires', () => {
    const players = [
      p('a', 80),
      p('b', 70),
      p('c', 60),
      p('d', 50),
      p('e', 40),
      p('f', 30),
      p('g', 20),
      p('h', 10),
    ]
    const st: TournamentState = {
      schemaVersion: 3,
      tournamentId: 't-schema3',
      tournamentName: 'x',
      createdAt: new Date().toISOString(),
      maxRounds: 3,
      format: 'elimination',
      elimFirstRound: 'elo',
      eliminationRound1Order: players.map((x) => x.id),
      players,
      activeRoundIndex: 4,
      finished: false,
      rounds: [
        {
          roundIndex: 4,
          completed: false,
          pairings: [
            {
              playerAId: 'a',
              playerBId: 'b',
              result: null,
              elim: {
                kind: 'main',
                key: 'main-2-0',
                mainDepth: 2,
                mainSlot: 0,
                connectFrom: ['main-1-0', 'main-1-1'],
              },
            },
            {
              playerAId: 'c',
              playerBId: 'd',
              result: null,
              elim: {
                kind: 'bronze',
                key: 'bronze-0',
                connectFrom: ['main-1-0', 'main-1-1'],
              },
            },
          ],
        },
      ],
    }
    const m = eliminationBracketMatches(st)
    expect(m.find((x) => x.key === 'main-2-0')?.elimKind).toBe('main')
    expect(m.find((x) => x.key === 'main-2-0')?.mainDepth).toBe(2)
    expect(m.find((x) => x.key === 'bronze-0')?.elimKind).toBe('bronze')
  })
})
