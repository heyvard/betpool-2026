import type { NextPage } from 'next'

import { Spinner } from '../../components/loading/Spinner'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { UseAllBets } from '../../queries/useAllBets'
import React from 'react'
import { PastBetView } from '../../components/bet/PastBetView'
import { fixLand } from '../../components/bet/BetView'
import NextLink from 'next/link'
import { BpCard } from '../../components/Card'
import { Alert } from '@/components/ui/alert'
import { Heading, Link } from '@/components/ui/typography'
import { useLanguage } from '../../i18n/LanguageContext'
import { tx } from '../../i18n/interpolate'

const Home: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { t, locale } = useLanguage()

    const router = useRouter()
    const { id } = router.query
    if (!data || isLoading) {
        return <Spinner />
    }
    const user = data.users.find((a) => a.id == id)!

    return (
        <>
            <Heading level="1" size="small" align="center" spacing>
                {tx(t.spilteKamper.resultater, { navn: user.name })}
            </Heading>
            {user.winner && (
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
            )}

            {data.bets.length == 0 && <Alert variant="info">{t.spilteKamper.ingenResultater}</Alert>}
            {data.bets
                .filter((a) => a.user_id == id)
                .sort((b, a) => dayjs(a.game_start).unix() - dayjs(b.game_start).unix())
                .map((a) => ({
                    ...a,
                    user: data.users.find((u) => u.id == a.user_id)!,
                }))
                .map((a) => (
                    <PastBetView key={a.match_num + a.user_id} bet={a} matchside={false} navn={user.name} />
                ))}
        </>
    )
}

export default Home
