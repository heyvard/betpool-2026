import type { NextPage } from 'next'
import dayjs from 'dayjs'
import { Zap } from 'lucide-react'
import { useMemo } from 'react'

import { cn } from '@/lib/utils'
import { UseAllBets, MatchBetMedScore, OtherUser } from '../queries/useAllBets'
import { LoadingScreen } from '../components/loading/LoadingScreen'
import { nå } from '../utils/testClock'
import { kanHaJoker } from '../data/matches'
import { fixLand } from '../components/bet/BetView'
import { hentFlag } from '../utils/lag'
import { rundeTilTekst } from '../utils/rundeTilTekst'
import { useLanguage } from '../i18n/LanguageContext'

type JokerStatus = 'traff' | 'bom' | 'paagar' | 'planlagt'

type BetMedBruker = MatchBetMedScore & {
    userName: string
    userPicture: string | null
}

function visningsnavn(navn: string): string {
    return navn.includes('@') ? navn.split('@')[0] : navn
}

function jokerStatus(bet: BetMedBruker): JokerStatus {
    if (bet.foreløpig) return 'paagar'
    if (dayjs(bet.game_start).isBefore(nå())) {
        return bet.riktigUtfall || bet.riktigResultat ? 'traff' : 'bom'
    }
    return 'planlagt'
}

interface AvatarProps {
    src?: string | null
    name?: string
    size?: number
}

function Avatar({ src, name, size = 32 }: AvatarProps) {
    return (
        <div
            className="shrink-0 rounded-full bg-stone-200 flex items-center justify-center overflow-hidden"
            style={{ width: size, height: size }}
        >
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={name} className="rounded-full object-cover w-full h-full" />
            ) : (
                <span
                    className="flex items-center justify-center rounded-full bg-blue-500 text-white w-full h-full"
                    style={{ fontSize: size * 0.45 }}
                >
                    {name ? name.charAt(0).toUpperCase() : ''}
                </span>
            )}
        </div>
    )
}

function StatusChip({ type, count }: { type: JokerStatus; count: number }) {
    const cls: Record<JokerStatus, string> = {
        traff: 'bg-emerald-100 text-emerald-700',
        bom: 'bg-stone-100 text-stone-500',
        paagar: 'bg-amber-100 text-amber-700',
        planlagt: 'bg-stone-100 text-stone-400',
    }
    const label: Record<JokerStatus, string> = {
        traff: 'traff',
        bom: 'bom',
        paagar: 'pågår',
        planlagt: 'planlagt',
    }
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 text-[11px] font-bold',
                'px-[9px] py-[3px] rounded-full',
                cls[type],
            )}
        >
            {count} {label[type]}
        </span>
    )
}

function StatusBadge({ status }: { status: JokerStatus }) {
    if (status === 'traff')
        return (
            <span
                className="inline-flex items-center gap-[3px] text-[10px] font-extrabold
                         uppercase tracking-[.04em] bg-emerald-100 text-emerald-700
                         px-[8px] py-[3px] rounded-full whitespace-nowrap"
            >
                ✓ Traff
            </span>
        )
    if (status === 'bom')
        return (
            <span
                className="inline-flex items-center gap-[3px] text-[10px] font-extrabold
                         uppercase tracking-[.04em] bg-stone-100 text-stone-500
                         px-[8px] py-[3px] rounded-full whitespace-nowrap"
            >
                ✗ Bom
            </span>
        )
    if (status === 'paagar')
        return (
            <span
                className="inline-flex items-center gap-[4px] text-[10px] font-extrabold
                         uppercase tracking-[.04em] bg-amber-100 text-amber-700
                         px-[8px] py-[3px] rounded-full whitespace-nowrap"
            >
                <span className="inline-block w-[6px] h-[6px] rounded-full bg-red-600 animate-pulse" />
                Pågår
            </span>
        )
    return null
}

function SpillerRad({ bet }: { bet: BetMedBruker }) {
    const status = jokerStatus(bet)
    return (
        <div
            className={cn(
                'bg-white border-t border-stone-100',
                'pl-9 pr-[18px] py-[7px]',
                'flex items-center gap-[9px]',
                status === 'bom' && 'opacity-65',
            )}
        >
            <Avatar src={bet.userPicture} name={bet.userName} size={28} />
            <span className="flex-1 text-[13px] font-semibold text-stone-900 truncate">
                {visningsnavn(bet.userName)}
            </span>
            <div className="flex items-center gap-[6px] shrink-0">
                <StatusBadge status={status} />
                {(status === 'traff' || status === 'bom') && (
                    <span
                        className={cn(
                            'bp-tabular text-[13px] font-extrabold',
                            status === 'traff' ? 'text-emerald-700' : 'text-stone-400',
                        )}
                    >
                        {status === 'traff' ? `+${bet.poeng}p` : '+0p'}
                    </span>
                )}
            </div>
        </div>
    )
}

const JokerbrukPage: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { locale } = useLanguage()

    const userMap = useMemo(() => {
        if (!data) return new Map<string, OtherUser>()
        return new Map(data.users.map((u) => [u.id, u]))
    }, [data])

    const jokerBets = useMemo((): BetMedBruker[] => {
        if (!data) return []
        return data.bets
            .filter((b) => b.joker === true && kanHaJoker(b.round))
            .map((b) => {
                const u = userMap.get(b.user_id)
                return {
                    ...b,
                    userName: u?.name ?? b.user_id,
                    userPicture: u?.picture ?? null,
                }
            })
    }, [data, userMap])

    const alleUsere = useMemo(() => {
        if (!data) return []
        return data.users.map((u) => ({ userId: u.id, userName: u.name, picture: u.picture }))
    }, [data])

    const startedeRunder = useMemo(() => {
        if (!data) return []
        const runderMedStart = new Set<number>()
        data.bets.forEach((b) => {
            if (dayjs(b.game_start).isBefore(nå()) && kanHaJoker(b.round)) {
                runderMedStart.add(b.round)
            }
        })
        return [...runderMedStart].sort((a, b) => a - b)
    }, [data])

    const antallTraff = jokerBets.filter((b) => jokerStatus(b) === 'traff').length
    const antallBom = jokerBets.filter((b) => jokerStatus(b) === 'bom').length
    const antallPaagar = jokerBets.filter((b) => jokerStatus(b) === 'paagar').length
    const antallBrukt = jokerBets.filter((b) => startedeRunder.includes(b.round)).length
    const antallAapen = alleUsere.length * startedeRunder.length - antallBrukt

    if (isLoading) return <LoadingScreen />

    if (startedeRunder.length === 0)
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
                <Zap className="h-10 w-10 text-stone-300 mb-3" />
                <p className="text-base font-semibold text-stone-900">Ingen jokere brukt ennå</p>
                <p className="text-sm text-stone-500 mt-1">Jokerbruk vises når første runde starter.</p>
            </div>
        )

    return (
        <div className="min-h-screen" style={{ background: '#fafaf9' }}>
            {/* Toppseksjon */}
            <div className="bg-white border-b border-stone-200 px-[18px] pt-[14px] pb-[11px]">
                <p className="text-[10px] font-bold tracking-[.18em] uppercase text-stone-400">Resultater</p>
                <h1 className="text-[19px] font-extrabold tracking-tight text-stone-900 mt-[3px]">Jokerbruk</h1>
                <p className="text-[12px] text-stone-400 mt-1">
                    Per runde · {antallBrukt} brukt, {Math.max(antallAapen, 0)} åpen
                </p>
            </div>

            {/* Oppsummeringslinje */}
            <div className="flex gap-[5px] flex-wrap px-[18px] py-[9px] bg-white border-b border-stone-200">
                {antallTraff > 0 && <StatusChip type="traff" count={antallTraff} />}
                {antallBom > 0 && <StatusChip type="bom" count={antallBom} />}
                {antallPaagar > 0 && <StatusChip type="paagar" count={antallPaagar} />}
            </div>

            {/* Runde-seksjoner */}
            {startedeRunder.map((runde, rundeIdx) => {
                const rundeJokere = jokerBets.filter((b) => b.round === runde)

                const kampMap = new Map<number, BetMedBruker[]>()
                rundeJokere.forEach((b) => {
                    const lista = kampMap.get(b.match_num) ?? []
                    lista.push(b)
                    kampMap.set(b.match_num, lista)
                })
                const sorterteKamper = [...kampMap.entries()].sort(
                    ([, a], [, b]) => dayjs(a[0].game_start).valueOf() - dayjs(b[0].game_start).valueOf(),
                )

                const harBruktJoker = new Set(rundeJokere.map((b) => b.user_id))
                const ikkebrukt = alleUsere.filter((u) => {
                    const harBetsIRunde = (data?.bets ?? []).some((b) => b.round === runde && b.user_id === u.userId)
                    return harBetsIRunde && !harBruktJoker.has(u.userId)
                })

                return (
                    <div key={runde}>
                        {/* Runde-header */}
                        <div
                            className={cn(
                                'bg-white px-[18px] py-3 flex items-baseline justify-between border-stone-200',
                                rundeIdx === 0 ? 'border-t' : 'border-t-2 mt-2',
                            )}
                        >
                            <span className="text-[13px] font-extrabold text-stone-900">
                                {rundeTilTekst(runde, locale)}
                            </span>
                            <span className="text-[11px] text-stone-500">
                                {rundeJokere.length} {rundeJokere.length === 1 ? 'joker' : 'jokere'}
                            </span>
                        </div>

                        {sorterteKamper.length === 0 && (
                            <div className="bg-white border-t border-stone-100 px-[18px] py-3">
                                <p className="text-[12.5px] text-stone-400 italic">
                                    Ingen jokere brukt i denne runden ennå.
                                </p>
                            </div>
                        )}

                        {sorterteKamper.map(([matchNum, bets]) => {
                            const rep = bets[0]
                            const matchStartet = dayjs(rep.game_start).isBefore(nå())
                            const kampLive = rep.foreløpig === true
                            const kampFerdig = matchStartet && !kampLive
                            const harTraffIKamp = bets.some((b) => b.riktigUtfall || b.riktigResultat)

                            const resultatNode = matchStartet ? (
                                <span
                                    className={cn(
                                        'text-[12px] font-extrabold bp-tabular flex items-center gap-1',
                                        kampFerdig && harTraffIKamp ? 'text-emerald-700' : 'text-stone-500',
                                    )}
                                >
                                    {kampLive && (
                                        <span className="inline-block w-[6px] h-[6px] rounded-full bg-red-600 animate-pulse" />
                                    )}
                                    {rep.home_result}–{rep.away_result}
                                    {kampFerdig && harTraffIKamp && ' ✓'}
                                </span>
                            ) : null

                            return (
                                <div key={matchNum}>
                                    {/* Kamp-header */}
                                    <div className="bg-white border-t border-stone-100 px-[18px] py-[8px] flex items-center justify-between">
                                        <span className="text-[12.5px] font-bold text-stone-700">
                                            {hentFlag(rep.home_team)} {fixLand(rep.home_team, locale)} —{' '}
                                            {fixLand(rep.away_team, locale)} {hentFlag(rep.away_team)}
                                        </span>
                                        {resultatNode}
                                    </div>

                                    {/* Spillerrader */}
                                    {bets.map((bet) => (
                                        <SpillerRad key={bet.user_id + bet.match_num} bet={bet} />
                                    ))}
                                </div>
                            )
                        })}

                        {/* Ikke brukt-seksjon */}
                        {ikkebrukt.length > 0 && (
                            <div className="bg-white border-t border-stone-200 px-[18px] pb-[14px]">
                                <p className="text-[10px] font-bold tracking-[.18em] uppercase text-stone-400 pt-[10px] pb-[6px]">
                                    Ikke brukt
                                </p>
                                <div className="flex flex-wrap gap-[6px]">
                                    {ikkebrukt.map((u) => (
                                        <div
                                            key={u.userId}
                                            className="flex items-center gap-[6px] bg-stone-100 rounded-full py-1 pl-[5px] pr-[10px]"
                                        >
                                            <Avatar src={u.picture} name={u.userName} size={22} />
                                            <span className="text-[12px] font-semibold text-stone-500">
                                                {visningsnavn(u.userName)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

export default JokerbrukPage
