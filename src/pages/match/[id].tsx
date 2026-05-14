import type { NextPage } from 'next'

import { fixLand } from '../../components/bet/BetView'
import { Spinner } from '../../components/loading/Spinner'
import { useRouter } from 'next/router'
import { UseAllBets } from '../../queries/useAllBets'
import React from 'react'
import { PastBetView } from '../../components/bet/PastBetView'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import { hentFlag } from '../../utils/lag'
import { UseUser } from '../../queries/useUser'
import { BodyShort, Heading } from '@/components/ui/typography'

const Home: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { data: me } = UseUser()

    const router = useRouter()
    const { id } = router.query
    if (!data || isLoading || !me) {
        return <Spinner />
    }

    const match = data.bets.find((a) => a.match_id == id)!
    const homeBets = match.matchpoeng.hjemme
    const drawBets = match.matchpoeng.uavgjort
    const awayBets = match.matchpoeng.borte
    const totalBets = homeBets + drawBets + awayBets

    let homePercentage = (homeBets / totalBets) * 100
    let drawPercentage = (drawBets / totalBets) * 100
    let awayPercentage = (awayBets / totalBets) * 100

    const minPercentage = 15
    let adjusted = false

    if (homePercentage < minPercentage) {
        homePercentage = minPercentage
        adjusted = true
    }
    if (drawPercentage < minPercentage) {
        drawPercentage = minPercentage
        adjusted = true
    }
    if (awayPercentage < minPercentage) {
        awayPercentage = minPercentage
        adjusted = true
    }

    if (adjusted) {
        const totalAdjusted = homePercentage + drawPercentage + awayPercentage
        const scale = 100 / totalAdjusted
        homePercentage *= scale
        drawPercentage *= scale
        awayPercentage *= scale
    }
    const matchensBets = data.bets
        .filter((a) => a.match_id == id)
        .map((a) => ({
            ...a,
            bet_id: a.match_id + a.user_id,
            user: data.users.find((u) => u.id == a.user_id)!,
        }))
    return (
        <>
            <Heading level="1" size="large" align="center">
                {fixLand(match.home_team)} vs {fixLand(match.away_team)}
            </Heading>
            <BodyShort align="center">{rundeTilTekst(match.round)}</BodyShort>
            <BodyShort align="center">
                {match.home_result} - {match.away_result}
            </BodyShort>
            <div className="mb-4">
                <div className="relative w-full h-5 rounded-lg mb-4">
                    <div
                        className="absolute h-5 rounded-l-lg bg-orange-200 flex items-center justify-center"
                        style={{ width: `${homePercentage}%` }}
                    >
                        <BodyShort>{`${homeBets} ${hentFlag(match.home_team)}`}</BodyShort>
                    </div>
                    <div
                        className="absolute h-5 bg-blue-200 flex items-center justify-center"
                        style={{ width: `${drawPercentage}%`, left: `${homePercentage}%` }}
                    >
                        <BodyShort>{`${drawBets} 🤝`}</BodyShort>
                    </div>
                    <div
                        className="absolute h-5 rounded-r-lg bg-red-200 flex items-center justify-center"
                        style={{ width: `${awayPercentage}%`, left: `${homePercentage + drawPercentage}%` }}
                    >
                        <BodyShort>{`${awayBets} ${hentFlag(match.away_team)}`}</BodyShort>
                    </div>
                </div>
                <BodyShort>
                    {`${match.matchpoeng.antallRiktigeSvar} stk (${Math.floor(match.matchpoeng.andelRiktigeResultat * 100)} %) har riktig resultat`}
                </BodyShort>
                <BodyShort spacing>
                    {`${match.matchpoeng.antallRiktigeUtfall} stk (${Math.floor(match.matchpoeng.andelRiktigeUtfall * 100)} %) har riktig utfall`}
                </BodyShort>
                <BodyShort>{`${match.matchpoeng.riktigResultat} poeng for riktig resultat`}</BodyShort>
                <BodyShort>{`${match.matchpoeng.riktigUtfall} poeng for riktig utfall`}</BodyShort>
            </div>
            {matchensBets
                .filter((a) => a.user.id == me.id)
                .map((a) => (
                    <PastBetView key={a.bet_id} bet={a} matchside={true} navn={a.user.name} />
                ))}
            {matchensBets
                .filter((a) => a.user.id != me.id)
                .sort((b, a) => b.user.name.localeCompare(a.user.name))
                .sort((b, a) => a.poeng - b.poeng)
                .map((a) => (
                    <PastBetView key={a.bet_id} bet={a} matchside={true} navn={a.user.name} />
                ))}
        </>
    )
}

export default Home
