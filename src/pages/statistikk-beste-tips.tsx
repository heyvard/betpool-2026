import type { NextPage } from 'next'
import { useMemo } from 'react'
import NextLink from 'next/link'

import { Spinner } from '../components/loading/Spinner'
import { UseAllBets } from '../queries/useAllBets'
import { calculateAllBetsExtended, filtrerAllBets } from '../components/results/calculateAllBetsExtended'
import { beregnBesteTips, BesteTippRad } from '../components/results/statistikkTopplister'
import { hentFlag, hentNavn } from '../utils/lag'
import { useLanguage } from '../i18n/LanguageContext'

function visningsnavn(navn: string): string {
    return navn.includes('@') ? navn.split('@')[0] : navn
}

interface AvatarProps {
    src?: string | null
    name?: string
}

const Avatar: React.FC<AvatarProps> = ({ src, name }) => (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-200">
        {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={name} className="h-10 w-10 rounded-full object-cover" />
        ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-base text-white">
                {name ? name.charAt(0).toUpperCase() : ''}
            </span>
        )}
    </div>
)

function BesteTippRadVisning({ rad, plass, locale }: { rad: BesteTippRad; plass: number; locale: 'no' | 'fr' }) {
    return (
        <NextLink
            href={`/match/${rad.bet.match_num}`}
            className="grid items-center gap-3 px-[18px] py-[11px]"
            style={{ gridTemplateColumns: '28px 1fr auto', borderBottom: '1px solid #f5f5f4' }}
        >
            <span className="bp-tabular w-full text-center text-[15px] font-bold text-stone-400">{plass}</span>

            <div className="flex min-w-0 items-center gap-[11px]">
                <Avatar src={rad.userPicture} name={rad.userName} />
                <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-semibold text-stone-900">
                        {visningsnavn(rad.userName)}
                    </div>
                    <div className="truncate text-xs text-stone-500">
                        {hentFlag(rad.bet.home_team)} {hentNavn(rad.bet.home_team, locale)} {rad.bet.home_score}–
                        {rad.bet.away_score} {hentNavn(rad.bet.away_team, locale)} {hentFlag(rad.bet.away_team)}
                    </div>
                </div>
            </div>

            <span className="bp-tabular text-right text-[19px] font-extrabold text-stone-900">{rad.bet.poeng}</span>
        </NextLink>
    )
}

const StatistikkBesteTips: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { t, locale } = useLanguage()

    const rader = useMemo<BesteTippRad[]>(() => {
        if (!data) return []
        const raw = data.raw
        const hovedligaIds = new Set(raw.users.filter((u) => u.i_hovedliga !== false).map((u) => u.id))
        const hovedligaExt = calculateAllBetsExtended(filtrerAllBets(raw, hovedligaIds))
        return beregnBesteTips(hovedligaExt.bets, hovedligaExt.users)
    }, [data])

    if (!data || isLoading) {
        return <Spinner />
    }

    return (
        <div className="-mx-2 bg-stone-50">
            <div className="bg-white px-[18px] pb-[12px] pt-[18px]" style={{ borderBottom: '1px solid #e7e5e4' }}>
                <p className="bp-overline text-stone-400">{t.nav.statistikk}</p>
                <p className="mt-[9px] text-[19px] font-extrabold leading-none tracking-[-0.01em] text-stone-900">
                    {t.statistikk.besteTipsTittel}
                </p>
                <p className="mt-2 text-xs text-stone-500">{t.statistikk.besteTipsUndertittel}</p>
            </div>

            <div
                className="bg-stone-50 px-[18px] pb-[7px] pt-[13px]"
                style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: '12px' }}
            >
                <span className="bp-overline text-center text-stone-400">{t.statistikk.plass}</span>
                <span className="bp-overline text-stone-400">{t.statistikk.tipp}</span>
                <span className="bp-overline text-right text-stone-400">{t.statistikk.poeng}</span>
            </div>

            {rader.length === 0 ? (
                <div className="bg-white px-[18px] py-10 text-center text-sm text-stone-500">
                    {t.statistikk.ingenTipsEnna}
                </div>
            ) : (
                <div className="bg-white">
                    {rader.map((rad, i) => (
                        <BesteTippRadVisning
                            key={`${rad.bet.match_num}-${rad.bet.user_id}`}
                            rad={rad}
                            plass={i + 1}
                            locale={locale}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default StatistikkBesteTips
