import type { NextPage } from 'next'
import { Spinner } from '../../components/loading/Spinner'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { UseAllBets } from '../../queries/useAllBets'
import React from 'react'
import { fixLand } from '../../components/bet/BetView'
import NextLink from 'next/link'
import { BpCard } from '../../components/Card'
import { Link } from '@/components/ui/typography'
import { useLanguage } from '../../i18n/LanguageContext'
import { RundeSeksjon, Legende } from '../../components/bet/PastBetView'

const AVATAR_FARGER = ['bg-rose-400', 'bg-amber-400', 'bg-emerald-500', 'bg-blue-500', 'bg-violet-500']

const Home: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { t, locale } = useLanguage()
    const router = useRouter()
    const { id } = router.query

    if (!data || isLoading) return <Spinner />

    const user = data.users.find((a) => a.id == id)!

    const userBets = data.bets
        .filter((a) => a.user_id == id)
        .sort((a, b) => dayjs(a.game_start).unix() - dayjs(b.game_start).unix())

    const totalPoeng = userBets.filter((b) => !b.foreløpig).reduce((sum, b) => sum + b.poeng, 0)

    const rundeMap = new Map<number, typeof userBets>()
    userBets.forEach((bet) => {
        if (!rundeMap.has(bet.round)) rundeMap.set(bet.round, [])
        rundeMap.get(bet.round)!.push(bet)
    })
    const runder = [...rundeMap.entries()].sort(([a], [b]) => b - a)

    const avatarFarge = AVATAR_FARGER[Math.abs((user.name.charCodeAt(0) || 0) % AVATAR_FARGER.length)]
    const undertittel = locale === 'fr' ? 'ses résultats' : 'sine resultater'

    return (
        <div className="pb-8">
            {/* Profil-header */}
            <div className="bg-white border-b border-[#e7e5e4] px-4 py-[14px]">
                <div className="flex items-center gap-3">
                    <div className="shrink-0">
                        {user.picture ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={user.picture} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${avatarFarge}`}
                            >
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[17px] font-extrabold tracking-[-0.01em] text-[#1c1917] truncate">
                            {user.name}
                        </div>
                        <div className="text-[11.5px] text-[#78716c]">{undertittel}</div>
                    </div>
                    <div className="shrink-0 text-right">
                        <div className="bp-tabular text-[22px] font-extrabold text-[#b45309] leading-none">
                            {totalPoeng}
                        </div>
                        <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#a8a29e] whitespace-nowrap mt-0.5">
                            {t.spilteKamper.poengTotalt}
                        </div>
                    </div>
                </div>
            </div>

            {/* Vinner / Toppscorer */}
            {user.winner && (
                <div className="mx-4 mt-4">
                    <BpCard>
                        <NextLink href="/winnerbets">
                            <Link>
                                {t.spilteKamper.vinner} {fixLand(user.winner || '', locale)} ({user.winnerPoints}{' '}
                                {t.felles.poeng})
                            </Link>
                        </NextLink>
                        <br />
                        <NextLink href="/toppscorer">
                            <Link>
                                {t.spilteKamper.toppscorer} {user.topscorer} ({user.topscorerPoints} {t.felles.poeng})
                            </Link>
                        </NextLink>
                    </BpCard>
                </div>
            )}

            {/* Ingen resultater */}
            {userBets.length === 0 && (
                <div className="text-center text-[#a8a29e] text-sm py-8">{t.spilteKamper.ingenResultater}</div>
            )}

            {/* Runder (nyeste først) */}
            {runder.map(([runde, bets]) => (
                <RundeSeksjon key={runde} runde={runde} bets={bets} locale={locale} />
            ))}

            {/* Legende */}
            {userBets.length > 0 && <Legende />}
        </div>
    )
}

export default Home
