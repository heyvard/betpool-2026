import teamsMeta from '../data/teamsMeta2026.json'
import { landNorsk } from '../data/landNorsk'

interface TeamMeta {
    name: string
    name_normalised?: string
    continent: string
    flag_icon: string
    flag_unicode: string
    fifa_code: string
    group: string
    confed: string
}

interface Lag {
    engelsk: string
    norsk: string
    flagg: string
    fifaKode: string
}

export const alleLag: Lag[] = (teamsMeta as TeamMeta[]).map((t) => ({
    engelsk: t.name,
    norsk: landNorsk[t.fifa_code] ?? t.name,
    flagg: t.flag_icon,
    fifaKode: t.fifa_code,
}))

const engelskMap = new Map<string, Lag>()

alleLag.forEach((l) => {
    engelskMap.set(l.engelsk, l)
})

export function hentFlag(engelskLag: string) {
    return engelskMap.get(engelskLag)?.flagg || ''
}

export function hentNorsk(engelskLag: string) {
    return engelskMap.get(engelskLag)?.norsk || engelskLag
}

export const alleLagSortert = [...alleLag].sort((a, b) => a.norsk.localeCompare(b.norsk))
