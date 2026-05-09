import { describe, expect, it } from 'vitest'
import {
  bracketSize,
  buildEliminationRoundOnePairings,
  eliminationMaxRounds,
  eliminationPhaseLabelFr,
  mainMatchKey,
  nextEliminationRoundPairings,
  standardLeafSeedOrder,
  wikiMatchSlotOrder,
} from './eliminationPairing'
import { initialTournamentState } from './tournamentFactory'
import type { Player, TournamentState } from './types'

function p(id: string, elo: number): Player {
  return { id, name: id, elo }
}

function baseState(players: Player[], order: string[]): TournamentState {
  return {
    schemaVersion: 3,
    tournamentId: 't-test',
    tournamentName: 'Test',
    createdAt: new Date().toISOString(),
    maxRounds: eliminationMaxRounds(players.length),
    format: 'elimination',
    elimFirstRound: 'elo',
    eliminationRound1Order: order,
    players,
    rounds: [],
    activeRoundIndex: 1,
    finished: false,
  }
}

describe('eliminationPhaseLabelFr', () => {
  it('3 rondes → quarts, demies, finale dans l’ordre chronologique', () => {
    const m = 3
    expect(eliminationPhaseLabelFr(1, m)).toBe('Quart de finale')
    expect(eliminationPhaseLabelFr(2, m)).toBe('Demi-finale')
    expect(eliminationPhaseLabelFr(3, m)).toBe('Finale')
  })

  it('4 rondes → huitièmes en premier', () => {
    const m = 4
    expect(eliminationPhaseLabelFr(1, m)).toBe('Huitième de finale')
    expect(eliminationPhaseLabelFr(4, m)).toBe('Finale')
  })

  it('1 ronde uniquement → finale', () => {
    expect(eliminationPhaseLabelFr(1, 1)).toBe('Finale')
  })
})

describe('bracketSize & eliminationMaxRounds', () => {
  it('pads to next power of 2', () => {
    expect(bracketSize(4)).toBe(4)
    expect(bracketSize(5)).toBe(8)
    expect(bracketSize(8)).toBe(8)
    expect(eliminationMaxRounds(6)).toBe(3)
    expect(eliminationMaxRounds(8)).toBe(3)
  })
})

describe('standardLeafSeedOrder & wikiMatchSlotOrder', () => {
  it('8 feuilles : ordre NCAA', () => {
    expect(standardLeafSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
  })
  it('4 emplacements de matchs R1 : ordre vertical Wikipédia', () => {
    expect(wikiMatchSlotOrder(4)).toEqual([0, 1, 3, 2])
  })
})

describe('buildEliminationRoundOnePairings', () => {
  it('8 joueurs : 4 matchs, ordre paires Wikipédia (quarts)', () => {
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
    const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const st = baseState(players, order)
    const pairings = buildEliminationRoundOnePairings(st)
    expect(pairings).toHaveLength(4)
    expect(pairings.every((x) => x.playerBId !== null)).toBe(true)
    const duels = pairings.map(
      (x) =>
        [x.playerAId, x.playerBId].sort().join('-') as string,
    )
    expect(duels[0]).toBe('a-h')
    expect(duels[1]).toBe('d-e')
    expect(duels[2]).toBe('c-f')
    expect(duels[3]).toBe('b-g')
    expect(pairings.every((x) => x.elim?.kind === 'main')).toBe(true)
  })

  it('6 joueurs : exempts meilleurs seeds + 2 vrais matchs', () => {
    const players = [p('a', 60), p('b', 50), p('c', 40), p('d', 30), p('e', 20), p('f', 10)]
    const order = ['a', 'b', 'c', 'd', 'e', 'f']
    const st = baseState(players, order)
    const pairings = buildEliminationRoundOnePairings(st)
    const byes = pairings.filter((x) => x.playerBId === null)
    const real = pairings.filter((x) => x.playerBId !== null)
    expect(byes).toHaveLength(2)
    expect(real).toHaveLength(2)
    expect(byes.map((x) => x.playerAId)).toEqual(['a', 'b'])
  })

  it('premier tour aléatoire : exempts suivent les 2 meilleurs rangs tirés', () => {
    const players = [p('a', 100), p('b', 90), p('c', 80), p('d', 70), p('e', 60), p('f', 50)]
    const order = ['f', 'e', 'a', 'b', 'c', 'd']
    const st = baseState(players, order)
    st.elimFirstRound = 'random'
    const pairings = buildEliminationRoundOnePairings(st)
    const byes = pairings.filter((x) => x.playerBId === null)
    expect(byes.map((x) => x.playerAId)).toEqual(['f', 'e'])
  })
})

describe('nextEliminationRoundPairings — arbre coupe', () => {
  it('après QF (tous vainqueurs = joueur A), propose demi-finales + début placements', () => {
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
    const st = initialTournamentState(players, null, null, {
      format: 'elimination',
      elimFirstRound: 'elo',
    })
    const r0 = st.rounds[0]
    r0.completed = true
    for (const pr of r0.pairings) {
      if (pr.playerBId) pr.result = 'A'
    }
    const wave2 = nextEliminationRoundPairings(st)
    const mainSf = wave2.filter((x) => x.elim?.kind === 'main')
    expect(mainSf).toHaveLength(2)
    expect(mainSf.every((x) => x.elim?.mainDepth === 1)).toBe(true)
    expect(wave2.some((x) => x.elim?.kind === 'placement')).toBe(true)
  })

  it('après demi-finales, une seule paire grande finale (clé stable), sans doublon Adel/Johann côté moteur', () => {
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
    const st = initialTournamentState(players, null, null, {
      format: 'elimination',
      elimFirstRound: 'elo',
    })
    const r0 = st.rounds[0]
    r0.completed = true
    for (const pr of r0.pairings) {
      if (pr.playerBId) pr.result = 'A'
    }
    const wave2 = nextEliminationRoundPairings(st)
    st.rounds.push({
      roundIndex: 2,
      pairings: wave2,
      completed: true,
    })
    for (const pr of wave2) {
      if (pr.elim?.kind === 'main' && pr.elim.mainDepth === 1 && pr.playerBId)
        pr.result = 'A'
    }
    const wave3 = nextEliminationRoundPairings(st)
    const fk = mainMatchKey(2, 0)
    const finalsSameKey = wave3.filter((x) => x.elim?.key === fk)
    expect(finalsSameKey).toHaveLength(1)
  })
})
