import { Trophy } from 'lucide-react'

import { PremieProsent } from '../types/league'
import { regnUtPremier } from '../utils/premier'

// Viser premiefordelingen i en privat liga: total pott og kr per plass. Pott
// regnes som innsats × antall medlemmer, og hver plass får sin andel av potten.
// Returnerer null hvis verten ikke har satt prosenter, eller hvis det ikke er
// nok info (mangler innsats / medlemmer) til å si noe meningsfullt.
export function PremieKort({
    liga,
    antallMedlemmer,
}: {
    liga: PremieProsent & { innsats: number | null }
    antallMedlemmer: number
}) {
    const premier = regnUtPremier(liga.innsats, antallMedlemmer, liga)
    if (!premier) return null
    return (
        <div className="bp-card">
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Premiefordeling
                </h2>
                <span className="text-xs text-stone-500">Pott: {premier.pott} kr</span>
            </div>
            <ul className="mt-3 divide-y divide-stone-100">
                {liga.premie_forste_prosent > 0 && (
                    <PremieRad emoji="🥇" plass="1. plass" prosent={liga.premie_forste_prosent} kr={premier.forste} />
                )}
                {liga.premie_andre_prosent > 0 && (
                    <PremieRad emoji="🥈" plass="2. plass" prosent={liga.premie_andre_prosent} kr={premier.andre} />
                )}
                {liga.premie_tredje_prosent > 0 && (
                    <PremieRad emoji="🥉" plass="3. plass" prosent={liga.premie_tredje_prosent} kr={premier.tredje} />
                )}
            </ul>
        </div>
    )
}

function PremieRad({ emoji, plass, prosent, kr }: { emoji: string; plass: string; prosent: number; kr: number }) {
    return (
        <li className="flex items-center justify-between py-2 text-sm">
            <span className="flex items-center gap-2">
                <span className="text-lg">{emoji}</span>
                <span className="font-medium text-stone-800">{plass}</span>
                <span className="text-xs text-stone-500">{prosent}%</span>
            </span>
            <span className="font-semibold text-stone-900">{kr} kr</span>
        </li>
    )
}
