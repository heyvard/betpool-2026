import type { NextPage } from 'next'

import { UseMyBets } from '../queries/useMyBets'
import { BetView } from '../components/bet/BetView'
import { Spinner } from '../components/loading/Spinner'
import dayjs from 'dayjs'
import NextLink from 'next/link'
import React from 'react'
import { UseUser } from '../queries/useUser'
import { nå } from '../utils/testClock'
import { LinkPanel } from '@/components/ui/link-panel'

const Home: NextPage = () => {
    const { data: myBets } = UseMyBets()
    const { data: megselv } = UseUser()

    if (!myBets || !megselv) {
        return <Spinner />
    }

    return (
        <>
            <div>
                <NextLink passHref legacyBehavior href={'/user/' + megselv.id}>
                    <LinkPanel className="text-xl">Tidligere kamper</LinkPanel>
                </NextLink>
            </div>

            {myBets
                .filter((b) => dayjs(b.game_start).isAfter(nå()))
                .map((a) => (
                    <BetView key={a.match_num} bet={a} matchside={false} />
                ))}
        </>
    )
}

export default Home
