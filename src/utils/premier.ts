import { PremieProsent } from '../types/league'

export interface Premier {
    /** Total pott i kr: innsats × antall medlemmer. */
    pott: number
    forste: number
    andre: number
    tredje: number
}

// Regner ut hvor mye som går til 1./2./3. plass i en privat liga ut fra
// ligaens innsats, antall medlemmer og prosentfordelingen verten har satt.
// Returnerer null hvis det ikke er nok info til å vise et premietall —
// ingen innsats, ingen medlemmer, eller ingen prosenter satt.
export function regnUtPremier(
    innsats: number | null,
    antallMedlemmer: number,
    prosenter: PremieProsent,
): Premier | null {
    if (innsats == null || innsats <= 0 || antallMedlemmer <= 0) return null
    const sum = prosenter.premie_forste_prosent + prosenter.premie_andre_prosent + prosenter.premie_tredje_prosent
    if (sum <= 0) return null
    const pott = innsats * antallMedlemmer
    return {
        pott,
        forste: Math.round((pott * prosenter.premie_forste_prosent) / 100),
        andre: Math.round((pott * prosenter.premie_andre_prosent) / 100),
        tredje: Math.round((pott * prosenter.premie_tredje_prosent) / 100),
    }
}
