import dayjs from 'dayjs'

import { Match } from '../types/types'

// Frist-datoer utledet fra kampprogrammet (klient-side, fra /api/v1/matches):
// - førsteRunde: starten på andre gruppespillsrunde (round=2) — frist for å
//   sette vinner/toppscorer.
// - endrevinduSlutt: starten på kvartfinalen (round=6) — endrevinduet er åpent
//   gjennom sekstendels- og åttendedelsfinalene frem til da.
function førsteKampstartIRunde(matches: Match[], round: number): dayjs.Dayjs | null {
    const tider = matches
        .filter((m) => m.round === round)
        .map((m) => dayjs(m.game_start))
        .sort((a, b) => a.valueOf() - b.valueOf())
    return tider[0] ?? null
}

export interface Frister {
    forsteRunde: dayjs.Dayjs | null
    endrevinduSlutt: dayjs.Dayjs | null
}

export function beregnFrister(matches: Match[]): Frister {
    return {
        forsteRunde: førsteKampstartIRunde(matches, 2),
        endrevinduSlutt: førsteKampstartIRunde(matches, 6),
    }
}

export function erEtterFørsteRunde(frister: Frister, tidspunkt: dayjs.Dayjs): boolean {
    return frister.forsteRunde != null && !frister.forsteRunde.isAfter(tidspunkt)
}

// Endrevinduet (endre vinner/toppscorer én gang etter runde 1 mot halverte
// poeng) er midlertidig avslått. Funksjonen åpnes manuelt om noen dager — sett
// flagget til true for å skru den på igjen. Brukes både her (klient) og av
// `erIEndrevinduMed` i isInFirstRound.ts (server).
export const ENDREVINDU_AKTIVERT = false

export function erIEndrevindu(frister: Frister, tidspunkt: dayjs.Dayjs): boolean {
    if (!ENDREVINDU_AKTIVERT) return false
    return (
        erEtterFørsteRunde(frister, tidspunkt) &&
        frister.endrevinduSlutt != null &&
        frister.endrevinduSlutt.isAfter(tidspunkt)
    )
}
