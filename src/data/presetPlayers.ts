/** Liste bureau : saisie manuelle ou choix rapide au setup. */
export const PRESET_PLAYERS = [
  { name: 'Alice', elo: 700 },
  { name: 'Bruno', elo: 660 },
  { name: 'Chloé', elo: 610 },
  { name: 'David', elo: 600 },
  { name: 'Eva', elo: 550 },
  { name: 'Fabien', elo: 550 },
  { name: 'Gabriel', elo: 400 },
  { name: 'Hanna', elo: 400 },
] as const

export type PresetRow = { name: string; elo: string }

export function rowsFromPresets(count: number): PresetRow[] {
  return Array.from({ length: count }, (_, i) => {
    const p = PRESET_PLAYERS[i]
    if (p) return { name: p.name, elo: String(p.elo) }
    return { name: `Joueur ${i + 1}`, elo: '1500' }
  })
}

export function matchPresetIndex(row: PresetRow): number | null {
  const eloN = Number.parseInt(row.elo, 10)
  if (Number.isNaN(eloN)) return null
  const idx = PRESET_PLAYERS.findIndex(
    (p) => p.name === row.name.trim() && p.elo === eloN,
  )
  return idx >= 0 ? idx : null
}

/** Indice de liste déjà choisi sur une autre ligne (même entrée bureau). */
export function isPresetUsedOnOtherRow(
  rows: PresetRow[],
  exceptRowIndex: number,
  presetIndex: number,
): boolean {
  return rows.some((row, j) => {
    if (j === exceptRowIndex) return false
    return matchPresetIndex(row) === presetIndex
  })
}

/** Message si deux noms identiques (après trim, insensible à la casse, fr). */
export function duplicatePlayerNameMessage(rows: PresetRow[]): string | null {
  const seen = new Map<string, string>()
  for (const r of rows) {
    const display = r.name.trim() || 'Sans nom'
    const key = display.toLocaleLowerCase('fr')
    if (seen.has(key)) {
      return `Chaque joueur doit avoir un nom unique. « ${display} » est en double (avec « ${seen.get(key)} »).`
    }
    seen.set(key, display)
  }
  return null
}
