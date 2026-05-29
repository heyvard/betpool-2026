import { landFlagg } from '../data/landFlagg'
import { landNorsk } from '../data/landNorsk'
import { landFransk } from '../data/landFransk'

// Lag identifiseres med tre-bokstavskoden (tla). football-data bruker URY for
// Uruguay; resten av appen bruker URU.
function normaliser(tla: string): string {
    return tla === 'URY' ? 'URU' : tla
}

export interface Lag {
    tla: string
    norsk: string
    flagg: string
}

export const alleLag: Lag[] = Object.keys(landNorsk).map((tla) => ({
    tla,
    norsk: landNorsk[tla],
    flagg: landFlagg[tla] ?? '',
}))

export function hentFlag(tla: string): string {
    return landFlagg[normaliser(tla)] ?? ''
}

export function hentNorsk(tla: string): string {
    return landNorsk[normaliser(tla)] ?? tla
}

export function hentNavn(tla: string, locale: 'no' | 'fr' = 'no'): string {
    const kode = normaliser(tla)
    if (locale === 'fr') return landFransk[kode] ?? landNorsk[kode] ?? tla
    return landNorsk[kode] ?? tla
}

export const alleLagSortert = [...alleLag].sort((a, b) => a.norsk.localeCompare(b.norsk))

export function getLagSortert(locale: 'no' | 'fr' = 'no') {
    return [...alleLag]
        .map((l) => ({
            ...l,
            visningsnavn: locale === 'fr' ? (landFransk[l.tla] ?? l.norsk) : l.norsk,
        }))
        .sort((a, b) => a.visningsnavn.localeCompare(b.visningsnavn, locale))
}
