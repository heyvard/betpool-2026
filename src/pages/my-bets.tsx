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
import { PushVarsler } from '../components/PushVarsler'

const Home: NextPage = () => {
    const { data: myBets } = UseMyBets()
    const { data: megselv } = UseUser()

    if (!myBets || !megselv) {
        return <Spinner />
    }

    // Hvilken kamp jokeren ligger på i hver runde.
    const jokerPerRunde = new Map<number, Bet>()
    myBets.forEach((b) => {
        if (b.joker) jokerPerRunde.set(b.round, b)
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

    return (
        <>
            <div>
                <NextLink passHref legacyBehavior href={'/user/' + megselv.id}>
                    <LinkPanel className="text-xl">Tidligere kamper</LinkPanel>
                </NextLink>
            </div>

            <PushVarsler />

            {myBets
                .filter((b) => dayjs(b.game_start).isAfter(nå()))
                .map((a) => (
                    <BetView key={a.match_num} bet={a} matchside={false} joker={lagJokerContext(a)} />
                ))}
        </>
    )
}

export default Home
