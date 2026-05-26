import { Trophy } from 'lucide-react'

import { PremieProsent } from '../types/league'
import { regnUtPremier } from '../utils/premier'
import { Medalje } from './ui/medalje'
import { useLanguage } from '../i18n/LanguageContext'
import { tx } from '../i18n/interpolate'

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
    const { t } = useLanguage()
    const premier = regnUtPremier(liga.innsats, antallMedlemmer, liga)
    if (!premier) return null
    return (
        <div className="bp-card">
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    {t.premieKort.tittel}
                </h2>
                <span className="text-xs text-stone-500">{tx(t.premieKort.pott, { kr: premier.pott })}</span>
            </div>
            <ul className="mt-3 divide-y divide-stone-100">
                {liga.premie_forste_prosent > 0 && (
                    <PremieRad plass={1} prosent={liga.premie_forste_prosent} kr={premier.forste} />
                )}
                {liga.premie_andre_prosent > 0 && (
                    <PremieRad plass={2} prosent={liga.premie_andre_prosent} kr={premier.andre} />
                )}
                {liga.premie_tredje_prosent > 0 && (
                    <PremieRad plass={3} prosent={liga.premie_tredje_prosent} kr={premier.tredje} />
                )}
            </ul>
        </div>
    )
}

function PremieRad({ plass, prosent, kr }: { plass: 1 | 2 | 3; prosent: number; kr: number }) {
    const { t } = useLanguage()
    return (
        <li className="flex items-center justify-between py-2 text-sm">
            <span className="flex items-center gap-2">
                <Medalje plass={plass} size={20} />
                <span className="font-medium text-stone-800">{t.felles.plass(plass)}</span>
                <span className="text-xs text-stone-500">{prosent}%</span>
            </span>
            <span className="font-semibold text-stone-900">
                {kr} {t.felles.kr}
            </span>
        </li>
    )
}
