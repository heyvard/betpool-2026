import type { NextPage } from 'next'
import { useMemo } from 'react'
import NextLink from 'next/link'

import { Spinner } from '../components/loading/Spinner'
import { UseAllBets } from '../queries/useAllBets'
import { calculateAllBetsExtended, filtrerAllBets } from '../components/results/calculateAllBetsExtended'
import { beregnVerdifulleKamper, VerdifullKampRad } from '../components/results/statistikkTopplister'
import { hentFlag, hentNavn } from '../utils/lag'
import { rundeTilTekst } from '../utils/rundeTilTekst'
import { useLanguage } from '../i18n/LanguageContext'

function VerdifullKampRadVisning({
    rad,
    plass,
    locale,
}: {
    rad: VerdifullKampRad
    plass: number
    locale: 'no' | 'fr'
}) {
    return (
        <NextLink
            href={`/match/${rad.match_num}`}
            className="grid items-center gap-3 px-[18px] py-[11px]"
            style={{ gridTemplateColumns: '28px 1fr auto', borderBottom: '1px solid #f5f5f4' }}
        >
            <span className="bp-tabular w-full text-center text-[15px] font-bold text-stone-400">{plass}</span>

            <div className="min-w-0">
                <div className="truncate text-xs text-stone-500">{rundeTilTekst(rad.round, locale)}</div>
                <div className="truncate text-[14.5px] font-semibold text-stone-900">
                    {hentFlag(rad.home_team)} {hentNavn(rad.home_team, locale)} {rad.home_score}–{rad.away_score}{' '}
                    {hentNavn(rad.away_team, locale)} {hentFlag(rad.away_team)}
                </div>
            </div>

            <span className="bp-tabular text-right text-[19px] font-extrabold text-stone-900">{rad.totalPoeng}</span>
        </NextLink>
    )
}

const StatistikkVerdifulleKamper: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { t, locale } = useLanguage()

    const rader = useMemo<VerdifullKampRad[]>(() => {
        if (!data) return []
        const raw = data.raw
        const hovedligaIds = new Set(raw.users.filter((u) => u.i_hovedliga !== false).map((u) => u.id))
        const hovedligaExt = calculateAllBetsExtended(filtrerAllBets(raw, hovedligaIds))
        return beregnVerdifulleKamper(hovedligaExt.bets)
    }, [data])

    if (!data || isLoading) {
        return <Spinner />
    }

    return (
        <div className="-mx-2 bg-stone-50">
            <div className="bg-white px-[18px] pb-[12px] pt-[18px]" style={{ borderBottom: '1px solid #e7e5e4' }}>
                <p className="bp-overline text-stone-400">{t.nav.statistikk}</p>
                <p className="mt-[9px] text-[19px] font-extrabold leading-none tracking-[-0.01em] text-stone-900">
                    {t.statistikk.verdifulleKamperTittel}
                </p>
                <p className="mt-2 text-xs text-stone-500">{t.statistikk.verdifulleKamperUndertittel}</p>
            </div>

            <div
                className="bg-stone-50 px-[18px] pb-[7px] pt-[13px]"
                style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: '12px' }}
            >
                <span className="bp-overline text-center text-stone-400">{t.statistikk.plass}</span>
                <span className="bp-overline text-stone-400">{t.statistikk.kamp}</span>
                <span className="bp-overline text-right text-stone-400">{t.statistikk.poeng}</span>
            </div>

            {rader.length === 0 ? (
                <div className="bg-white px-[18px] py-10 text-center text-sm text-stone-500">
                    {t.statistikk.ingenKamperEnna}
                </div>
            ) : (
                <div className="bg-white">
                    {rader.map((rad, i) => (
                        <VerdifullKampRadVisning key={rad.match_num} rad={rad} plass={i + 1} locale={locale} />
                    ))}
                </div>
            )}
        </div>
    )
}

export default StatistikkVerdifulleKamper
