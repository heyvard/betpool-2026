import type { NextPage } from 'next'

import { UseMyBets } from '../queries/useMyBets'
import { BetView, fixLand, JokerContext } from '../components/bet/BetView'
import { Spinner } from '../components/loading/Spinner'
import dayjs from 'dayjs'
import NextLink from 'next/link'
import React from 'react'
import { UseUser } from '../queries/useUser'
import { nå } from '../utils/testClock'
import { LinkPanel } from '@/components/ui/link-panel'
import { Bet } from '../types/types'
import { erNorgeKamp, kanHaJoker } from '../data/matches'
import { rundeTilTekst } from '../utils/rundeTilTekst'
import { Zap } from 'lucide-react'

const Home: NextPage = () => {
    const { data: myBets } = UseMyBets()
    const { data: megselv } = UseUser()

    if (!myBets || !megselv) {
        return <Spinner />
    }

    // Hvilken kamp jokeren ligger på i hver runde. Norge-kamper kan ikke jokres,
    // så en evt. gammel joker der ignoreres.
    const jokerPerRunde = new Map<number, Bet>()
    myBets.forEach((b) => {
        if (b.joker && !erNorgeKamp(b.home_team, b.away_team)) jokerPerRunde.set(b.round, b)
    })

    const kampnavn = (b: Bet) => `${fixLand(b.home_team)} – ${fixLand(b.away_team)}`

    const lagJokerContext = (bet: Bet): JokerContext => {
        const jokerKamp = jokerPerRunde.get(bet.round)
        if (!jokerKamp) {
            return { aktiv: false, bruktPå: null, låst: false }
        }
        if (jokerKamp.match_num === bet.match_num) {
            return { aktiv: true, bruktPå: null, låst: false }
        }
        return {
            aktiv: false,
            bruktPå: kampnavn(jokerKamp),
            låst: dayjs(jokerKamp.game_start).isBefore(nå()),
        }
    }

    const kommende = myBets.filter((b) => dayjs(b.game_start).isAfter(nå()))

    const grupper = new Map<number, Bet[]>()
    for (const b of kommende) {
        const liste = grupper.get(b.round) ?? []
        liste.push(b)
        grupper.set(b.round, liste)
    }
    const sortertRunder = [...grupper.keys()].sort((a, b) => a - b)

    return (
        <>
            <div>
                <NextLink passHref legacyBehavior href={'/user/' + megselv.id}>
                    <LinkPanel className="text-xl">Spilte kamper</LinkPanel>
                </NextLink>
            </div>

            <ProgresjonsKort myBets={myBets} />

            {sortertRunder.map((round) => {
                const kamperIRunde = grupper.get(round)!
                const tippet = kamperIRunde.filter((b) => b.home_score != null && b.away_score != null).length
                return (
                    <section key={round} className="space-y-1">
                        <h2 className="sticky top-0 z-10 -mx-2 bg-stone-50/80 px-3 py-2 text-xs font-bold uppercase tracking-wider text-stone-600 backdrop-blur">
                            {rundeTilTekst(round)} · {tippet} / {kamperIRunde.length} tippet
                        </h2>
                        {kanHaJoker(round) &&
                            !jokerPerRunde.has(round) &&
                            kamperIRunde.some((b) => dayjs(b.game_start).isAfter(nå())) && (
                                <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                                    <Zap className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                                    Jokeren er ikke brukt denne runden — dobler én kamp.
                                </div>
                            )}
                        {kamperIRunde.map((b) => (
                            <BetView key={b.match_num} bet={b} matchside={false} joker={lagJokerContext(b)} />
                        ))}
                    </section>
                )
            })}
        </>
    )
}

function ProgresjonsKort({ myBets }: { myBets: Bet[] }) {
    const kommende = myBets.filter((b) => dayjs(b.game_start).isAfter(nå()))
    const tippet = kommende.filter((b) => b.home_score != null && b.away_score != null).length
    const totalt = kommende.length
    const prosent = totalt > 0 ? (tippet / totalt) * 100 : 0
    return (
        <div className="bp-card">
            <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-stone-900">
                    {tippet} av {totalt} kommende kamper tippet
                </span>
                <span className="bp-tabular text-xs text-stone-500">{Math.round(prosent)} %</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${prosent}%` }} />
            </div>
        </div>
    )
}

export default Home
