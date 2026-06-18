import { ReactElement, useEffect, useState } from 'react'

import { MatchStatus } from '../../types/types'
import { beregnKampKlokke, formaterKampMinutt, KampKlokke } from '../../utils/kampklokke'
import { nå } from '../../utils/testClock'

// Tikker hvert sekund så den klientberegnede matchklokka oppdateres live.
// Leser `nå()` (som respekterer test-klokka i e2e/integrasjon) hver gang.
function useTikk(intervalMs = 1000): Date {
    const [tid, setTid] = useState(() => nå().toDate())
    useEffect(() => {
        const id = setInterval(() => setTid(nå().toDate()), intervalMs)
        return () => clearInterval(id)
    }, [intervalMs])
    return tid
}

// Returnerer den løpende matchklokka for en kamp og re-rendrer hvert sekund.
export function useKampKlokke(gameStart: string, status?: MatchStatus): KampKlokke {
    const tid = useTikk()
    return beregnKampKlokke(gameStart, tid, status)
}

// Liten tekst-etikett for det løpende minuttet («63'» / «45+» / pause / fallback).
// Egen komponent fordi useKampKlokke er en hook og dermed ikke kan kalles inne i
// en .map() – kallsteder som lister flere live-kamper rendrer denne per rad.
export function KampMinuttEtikett({
    gameStart,
    status,
    pauseTekst,
    fallbackTekst,
}: {
    gameStart: string
    status?: MatchStatus
    pauseTekst: string
    fallbackTekst: string
}): ReactElement {
    const klokke = useKampKlokke(gameStart, status)
    const tekst = klokke.type === 'pause' ? pauseTekst : (formaterKampMinutt(klokke) ?? fallbackTekst)
    return <>{tekst}</>
}
