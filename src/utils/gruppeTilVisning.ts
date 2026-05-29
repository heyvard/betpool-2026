// Gruppen lagres som "Group A" (se gruppeTilTekst i footballDataMatch.ts).
// I UI vises den lokalisert: «Gruppe A» (no) / «Groupe A» (fr).
export function gruppeTilVisning(group: string | undefined, locale: 'no' | 'fr' = 'no'): string | undefined {
    if (!group) return undefined
    const bokstav = group.replace(/^Group\s+/, '')
    const prefiks = locale === 'fr' ? 'Groupe' : 'Gruppe'
    return `${prefiks} ${bokstav}`
}
