import type { NextPage } from 'next'

import { Spinner } from '../components/loading/Spinner'
import dayjs from 'dayjs'
import { UseMatches } from '../queries/useMatches'
import { MatchView } from '../components/resultatservice/MatchView'
import React from 'react'
import { Heading } from '@/components/ui/typography'

const Home: NextPage = () => {
    const { data: matches } = UseMatches()
    if (!matches) {
        return <Spinner />
    }

    return (
        <>
            <Heading level="1" size="medium" align="center">
                Rediger resultater
            </Heading>
            {matches
                .filter((b) => dayjs(b.game_start).isBefore(dayjs()))
                .sort((a, b) => dayjs(b.game_start).diff(dayjs(a.game_start)))
                .map((a) => (
                    <MatchView key={a.match_num} match={a} />
                ))}
        </>
    )
}

export default Home
