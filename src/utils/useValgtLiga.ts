import { useEffect, useState } from 'react'

// Hvilken liga som er valgt i resultattabellen. `null` = hovedligaen.
// Valget huskes i localStorage så det består mellom besøk. Vi leser ikke
// localStorage under render (SSR-trygt) — verdien hentes inn i en effekt etter
// mount, så server og første klient-render er like.
const KEY = 'betpool_valgt_liga'

export function useValgtLiga(): [string | null, (id: string | null) => void] {
    const [valgt, setValgt] = useState<string | null>(null)

    useEffect(() => {
        const lagret = window.localStorage.getItem(KEY)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (lagret) setValgt(lagret)
    }, [])

    const sett = (id: string | null) => {
        setValgt(id)
        if (id) {
            window.localStorage.setItem(KEY, id)
        } else {
            window.localStorage.removeItem(KEY)
        }
    }

    return [valgt, sett]
}
