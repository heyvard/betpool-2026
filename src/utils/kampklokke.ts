import { MatchStatus } from '../types/types'

// Klientberegnet «matchklokke». football-data gir ikke et live-minutt på
// gratis-planen, og synken kjører bare hver time — så vi kan ikke lagre et
// pålitelig minutt-tall i DB. I stedet anslår vi minuttet ut fra `game_start`
// og «nå» i nettleseren. Det blir omtrentlig: vi vet ikke om avspark er
// forsinket, eksakt tilleggstid, eller forlengelse i sluttspillet. Derfor
// fryser vi på «45+» / «90+» rundt overgangene i stedet for å lyve med presise
// tall, og viser «Pause» i det antatte pausevinduet (eller når status = PAUSED).
export type KampKlokke =
    | { type: 'ikkeStartet' }
    | { type: 'spiller'; minutt: number; tillegg: boolean }
    | { type: 'pause' }
    | { type: 'ferdig' }

const FORSTE_OMGANG = 45 // 1. omgang spilles 0–45
const PAUSE_START = 47 // antatt slutt på 1. omgangs tilleggstid → pause begynner
const ANDRE_OMGANG_START = 60 // antatt avspark 2. omgang (45 spilt + 15 min pause)
const FULL_TID = 105 // 60 + 45 → slutten på ordinær tid

export function beregnKampKlokke(gameStart: string | Date, now: Date, status?: MatchStatus): KampKlokke {
    // Synket status er sannhet når vi har den (men den kan være opptil en time
    // gammel siden synken kjører hver time).
    if (status === 'FINISHED' || status === 'AWARDED') return { type: 'ferdig' }
    if (status === 'PAUSED') return { type: 'pause' }

    const start = new Date(gameStart).getTime()
    const minutterSidenStart = Math.floor((now.getTime() - start) / 60000)

    if (minutterSidenStart < 0) return { type: 'ikkeStartet' }

    // 1. omgang: 1'–45'
    if (minutterSidenStart < FORSTE_OMGANG) {
        return { type: 'spiller', minutt: minutterSidenStart + 1, tillegg: false }
    }
    // 1. omgangs tilleggstid — vi vet ikke hvor lang, så vis «45+»
    if (minutterSidenStart < PAUSE_START) {
        return { type: 'spiller', minutt: 45, tillegg: true }
    }
    // Antatt pause
    if (minutterSidenStart < ANDRE_OMGANG_START) {
        return { type: 'pause' }
    }
    // 2. omgang: 46'–90'
    if (minutterSidenStart < FULL_TID) {
        return { type: 'spiller', minutt: 46 + (minutterSidenStart - ANDRE_OMGANG_START), tillegg: false }
    }
    // Tilleggstid i 2. omgang / forlengelse vi ikke modellerer → «90+»
    return { type: 'spiller', minutt: 90, tillegg: true }
}

// Minutt-teksten til en kamp som spilles, f.eks. «63'» eller «45+». Returnerer
// null for ikke-startet/pause/ferdig — de håndteres med egne (oversatte) tekster.
export function formaterKampMinutt(klokke: KampKlokke): string | null {
    if (klokke.type !== 'spiller') return null
    return klokke.tillegg ? `${klokke.minutt}+` : `${klokke.minutt}'`
}
