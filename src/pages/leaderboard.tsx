import type { NextPage } from 'next'
import { useMemo, useState } from 'react'
import classNames from 'classnames'
import NextLink from 'next/link'

import { Spinner } from '../components/loading/Spinner'
import { UseAllBets } from '../queries/useAllBets'
import { calculateLeaderboard, LeaderBoard } from '../components/results/calculateAllScores'
import { calculateAllBetsExtended, filtrerAllBets } from '../components/results/calculateAllBetsExtended'
import { UseLeagues } from '../queries/useLeagues'
import { UseLeague } from '../queries/useLeague'
import { useValgtLiga } from '../utils/useValgtLiga'
import { LigaVelger } from '../components/LigaVelger'
import { Medalje } from '../components/ui/medalje'
import { useLanguage } from '../i18n/LanguageContext'

function visningsnavn(navn: string): string {
    return navn.includes('@') ? navn.split('@')[0] : navn
}

function ordningsverdi(seed: number, userid: string): number {
    let h = seed | 0
    for (let i = 0; i < userid.length; i++) {
        h = (Math.imul(31, h) + userid.charCodeAt(i)) | 0
    }
    return h
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

function LiveBryter({ visPågående, onChange }: { visPågående: boolean; onChange: (v: boolean) => void }) {
    const { t } = useLanguage()
    return (
        <div
            className="flex items-center justify-between bg-white px-[18px] py-[11px]"
            style={{ borderBottom: '1px solid #e7e5e4' }}
        >
            <div className="flex items-center gap-2">
                <span className="inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-red-600 animate-[ls-dot-pulse_1.8s_ease-in-out_infinite]" />
                <span className="text-[12px] font-bold text-stone-600">
                    {visPågående ? t.ledertavle.livePoengTeller : t.ledertavle.livePoengSkjult}
                </span>
            </div>
            <div className="flex items-center rounded-full p-[3px]" style={{ background: '#f5f5f4' }}>
                <button
                    type="button"
                    onClick={() => onChange(true)}
                    style={{ minHeight: 28 }}
                    className={classNames(
                        'rounded-full px-3 text-[12px] font-bold transition-all',
                        visPågående ? 'bg-white text-stone-900 shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-stone-500',
                    )}
                >
                    {t.ledertavle.paa}
                </button>
                <button
                    type="button"
                    onClick={() => onChange(false)}
                    style={{ minHeight: 28 }}
                    className={classNames(
                        'rounded-full px-3 text-[12px] font-bold transition-all',
                        !visPågående ? 'bg-white text-stone-900 shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-stone-500',
                    )}
                >
                    {t.ledertavle.av}
                </button>
            </div>
        </div>
    )
}

interface LeaderboardRadProps {
    row: LeaderBoard
    plass: number
    index: number
    alleNull: boolean
    visPågående: boolean
    effektivPoeng: (r: LeaderBoard) => number
}

function LeaderboardRad({ row, plass, index, alleNull, visPågående, effektivPoeng }: LeaderboardRadProps) {
    const { t } = useLanguage()
    const erLeder = index === 0 && !alleNull
    const erTopp3 = plass <= 3

    return (
        <div
            className="grid items-center px-[18px] py-[11px]"
            style={{
                gridTemplateColumns: '42px 1fr auto',
                gap: '12px',
                background: erLeder ? 'linear-gradient(90deg,#fffdf5,#fff)' : undefined,
                borderBottom: '1px solid #f5f5f4',
                minHeight: 44,
            }}
        >
            {/* Plass */}
            <div className="flex items-center justify-center">
                {erTopp3 ? (
                    <Medalje plass={plass as 1 | 2 | 3} size={30} />
                ) : (
                    <span className="bp-tabular w-full text-center text-[15px] font-bold text-stone-400">{plass}</span>
                )}
            </div>

            {/* Navn */}
            <NextLink href={'/user/' + row.userid} className="flex min-w-0 items-center gap-[11px]">
                <Avatar src={row.picture} name={row.userName} />
                <div className="min-w-0">
                    <div
                        className={classNames(
                            'truncate text-[14.5px] text-stone-900',
                            erTopp3 ? 'font-bold' : 'font-semibold',
                        )}
                    >
                        {visningsnavn(row.userName)}
                    </div>
                    {!row.paid && (
                        <span
                            className="mt-0.5 inline-block text-[9px] font-extrabold uppercase tracking-[.04em] text-amber-700"
                            style={{
                                background: '#fef3c7',
                                border: '1px solid #fde9b3',
                                padding: '2px 6px',
                                borderRadius: '999px',
                            }}
                        >
                            {t.ledertavle.ikkeBetalt}
                        </span>
                    )}
                </div>
            </NextLink>

            {/* Poeng */}
            <div className="flex items-center justify-end gap-[7px]">
                {visPågående && (row.livePoeng ?? 0) > 0 && (
                    <span
                        className="bp-tabular text-[11px] font-extrabold text-red-600"
                        style={{
                            background: '#fee2e2',
                            padding: '2px 7px',
                            borderRadius: '999px',
                        }}
                    >
                        +{(row.livePoeng ?? 0).toFixed(0)}
                    </span>
                )}
                <span
                    className="bp-tabular text-right text-[19px] font-extrabold text-stone-900"
                    style={{ minWidth: '24px' }}
                >
                    {effektivPoeng(row).toFixed(0)}
                </span>
            </div>
        </div>
    )
}

const Leaderboard: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { data: ligaer } = UseLeagues()
    const [valgtLiga, setValgtLiga] = useValgtLiga()
    const { t } = useLanguage()
    const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff))
    const [visPågående, setVisPågående] = useState(true)

    const mineLigaer = (ligaer ?? []).filter((l) => l.my_status === 'medlem')
    const effektivLiga = valgtLiga && mineLigaer.some((l) => l.id === valgtLiga) ? valgtLiga : null
    const { data: ligaDetalj } = UseLeague(effektivLiga)

    const rader = useMemo<LeaderBoard[]>(() => {
        if (!data) return []
        const raw = data.raw
        const hovedligaIds = new Set(raw.users.filter((u) => u.i_hovedliga !== false).map((u) => u.id))
        const hovedligaExt = calculateAllBetsExtended(filtrerAllBets(raw, hovedligaIds))
        const hovedligaTavle = calculateLeaderboard(hovedligaExt.bets, hovedligaExt.users)

        if (effektivLiga && ligaDetalj) {
            const populasjon = new Set(hovedligaIds)
            ligaDetalj.members.forEach((m) => populasjon.add(m.user_id))
            const ext = calculateAllBetsExtended(filtrerAllBets(raw, populasjon))
            const tavle = calculateLeaderboard(ext.bets, ext.users)
            const poengMap = new Map(tavle.map((r) => [r.userid, r.poeng]))
            const liveMap = new Map(tavle.map((r) => [r.userid, r.livePoeng ?? 0]))
            return ligaDetalj.members
                .filter((m) => m.status === 'medlem')
                .map((m) => ({
                    userid: m.user_id,
                    poeng: poengMap.get(m.user_id) ?? 0,
                    livePoeng: liveMap.get(m.user_id) ?? 0,
                    userName: m.name,
                    paid: m.paid,
                    picture: m.picture,
                }))
        }
        return hovedligaTavle
    }, [data, effektivLiga, ligaDetalj])

    const antallHovedliga = useMemo(() => {
        if (!data) return 0
        return data.raw.users.filter((u) => u.i_hovedliga !== false).length
    }, [data])

    if (!data || isLoading || !ligaer) {
        return <Spinner />
    }
    if (effektivLiga && !ligaDetalj) {
        return <Spinner />
    }

    const lista: LeaderBoard[] = [...rader]

    const effektivPoeng = (r: LeaderBoard): number => (visPågående ? r.poeng : r.poeng - (r.livePoeng ?? 0))

    const harPågående = rader.some((r) => (r.livePoeng ?? 0) !== 0)

    const alleNull = lista.length > 0 && lista.every((r) => effektivPoeng(r) === 0)

    if (alleNull) {
        lista.sort((a, b) => ordningsverdi(seed, a.userid) - ordningsverdi(seed, b.userid))
    } else {
        lista.sort((a, b) => {
            if (effektivPoeng(b) === effektivPoeng(a)) {
                return a.userid.localeCompare(b.userid)
            } else {
                return effektivPoeng(b) - effektivPoeng(a)
            }
        })
    }

    const finnFaktiskPlass = (index: number, lista: LeaderBoard[]): number => {
        if (alleNull) return index + 1
        if (index === 0) return 1
        if (effektivPoeng(lista[index]) === effektivPoeng(lista[index - 1])) {
            return finnFaktiskPlass(index - 1, lista)
        }
        return index + 1
    }

    return (
        // -mx-2 cancels the layout's px-2 so sections can be edge-to-edge
        <div className="-mx-2 bg-stone-50">
            {/* Header */}
            <div className="bg-white px-[18px] pb-[12px] pt-[18px]" style={{ borderBottom: '1px solid #e7e5e4' }}>
                <p className="bp-overline text-stone-400">{t.nav.resultater}</p>
                {mineLigaer.length > 0 ? (
                    <LigaVelger
                        ligaer={ligaer}
                        valgt={effektivLiga}
                        onVelg={setValgtLiga}
                        antallHovedliga={antallHovedliga}
                    />
                ) : (
                    <p className="mt-[9px] text-[19px] font-extrabold leading-none tracking-[-0.01em] text-stone-900">
                        {t.ledertavle.hovedligaen}
                    </p>
                )}
            </div>

            {/* Live-bryter */}
            {harPågående && <LiveBryter visPågående={visPågående} onChange={setVisPågående} />}

            {/* Kolonneoverskrifter */}
            <div
                className="bg-stone-50 px-[18px] pb-[7px] pt-[13px]"
                style={{
                    display: 'grid',
                    gridTemplateColumns: '42px 1fr auto',
                    gap: '12px',
                }}
            >
                <span className="bp-overline text-center text-stone-400">{t.ledertavle.plass}</span>
                <span className="bp-overline text-stone-400">{t.ledertavle.navn}</span>
                <span className="bp-overline text-right text-stone-400">{t.ledertavle.poeng}</span>
            </div>

            {/* Rad-liste */}
            <div className="bg-white">
                {lista.map((row, i) => (
                    <LeaderboardRad
                        key={row.userid}
                        row={row}
                        plass={finnFaktiskPlass(i, lista)}
                        index={i}
                        alleNull={alleNull}
                        visPågående={visPågående}
                        effektivPoeng={effektivPoeng}
                    />
                ))}
            </div>
        </div>
    )
}

export default Leaderboard
