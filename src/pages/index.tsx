import type { NextPage } from 'next'

import { UseUser } from '../queries/useUser'

import React, { useEffect, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { alleLagSortert } from '../utils/lag'
import { UseMatches } from '../queries/useMatches'
import dayjs from 'dayjs'
import NextLink from 'next/link'
import { fixLand } from '../components/bet/BetView'
import { getFirebaseAuth } from '../auth/clientApp'
import { Alert, Button, LinkPanel, TextField, Select } from '@navikt/ds-react'
import { FloppydiskIcon } from '@navikt/aksel-icons'
import { useQueryClient } from '@tanstack/react-query'
import nb from 'dayjs/locale/nb'
import { erEtterFørsteRunde, førsteRunde } from '../utils/isInFirstRound'
import { LoadingScreen } from '../components/loading/LoadingScreen'

dayjs.locale(nb)

const Home: NextPage = () => {
    const { data: megselv } = UseUser()
    const [user] = useAuthState(getFirebaseAuth())
    const [lagrer, setLagrer] = useState(false)
    const queryClient = useQueryClient()
    const [topscorer, setTopscorer] = useState(megselv?.topscorer)
    const { data: matches, isLoading: isLoading2 } = UseMatches()
    useEffect(() => {
        if (megselv) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTopscorer(megselv.topscorer)
        }
    }, [megselv, setTopscorer])
    if (!matches || isLoading2) {
        return <LoadingScreen />
    }
    if (!megselv) {
        return <LoadingScreen></LoadingScreen>
    }

    const kamper = matches.filter((a) => {
        return dayjs(a.game_start).isAfter(dayjs().subtract(2, 'hours')) && dayjs(a.game_start).isBefore(dayjs())
    })
    const snartKamper = matches.filter((a) => {
        return dayjs(a.game_start).isAfter(dayjs()) && dayjs(a.game_start).isBefore(dayjs().add(2, 'hours'))
    })
    return (
        <div className={'space-y-4'}>
            {kamper.map((k) => {
                return (
                    <div key={k.id}>
                        <NextLink href={'/match/' + k.id}>
                            <LinkPanel className={'rounded-xl shadow border-0'}>
                                Nå pågår {fixLand(k.home_team)} vs {fixLand(k.away_team)}
                            </LinkPanel>
                        </NextLink>
                    </div>
                )
            })}
            {snartKamper.map((k) => {
                return (
                    <div key={k.id}>
                        <NextLink href={'/my-bets/'}>
                            <LinkPanel className={'rounded-xl shadow border-0'}>
                                {fixLand(k.home_team)} vs {fixLand(k.away_team)} starter kl{' '}
                                {dayjs(k.game_start).format('HH:mm')}
                            </LinkPanel>
                        </NextLink>
                    </div>
                )
            })}

            {!megselv.paid && (
                <Alert variant={'warning'} className={'rounded-xl border-0 shadow shadow-border-warning'}>
                    Din innbetaling er ikke registrert ennå. 300kr må være vippset innen start på første kamp til 918 65
                    052.
                </Alert>
            )}

            <div className={'my-4 p-4 shadow bg-white rounded-xl'}>
                <Select
                    label={'Hvem vinner EM?'}
                    description={'Kan endres frem til ' + førsteRunde.locale(nb).format('dddd D MMM  kl HH:mm')}
                    disabled={lagrer || erEtterFørsteRunde()}
                    value={megselv.winner}
                    onChange={async (e) => {
                        try {
                            let winner = e.target.value.toString()
                            setLagrer(true)
                            const idtoken = await user?.getIdToken()
                            const responsePromise = await fetch(`/api/v1/me/`, {
                                method: 'PUT',
                                body: JSON.stringify({ winner: winner }),
                                headers: { Authorization: `Bearer ${idtoken}` },
                            })
                            if (!responsePromise.ok) {
                                window.alert('oops, feil ved lagring')
                            }
                            queryClient
                                .invalidateQueries({
                                    queryKey: ['user-me'],
                                })
                                .then()
                            queryClient
                                .invalidateQueries({
                                    queryKey: ['stats'],
                                })
                                .then()
                        } finally {
                            setLagrer(false)
                        }
                    }}
                >
                    {alleLagSortert.map((l) => {
                        return (
                            <option key={l.engelsk} value={l.engelsk}>
                                {l.flagg + ' ' + l.norsk}
                            </option>
                        )
                    })}
                </Select>
            </div>

            <div className={'my-4 p-4 shadow bg-white rounded-xl'}>
                <form
                    onSubmit={async (e) => {
                        e.preventDefault()
                        try {
                            setLagrer(true)
                            const idtoken = await user?.getIdToken()
                            const responsePromise = await fetch(`/api/v1/me/`, {
                                method: 'PUT',
                                body: JSON.stringify({ topscorer: topscorer }),
                                headers: { Authorization: `Bearer ${idtoken}` },
                            })
                            if (!responsePromise.ok) {
                                window.alert('oops, feil ved lagring')
                            }
                            queryClient
                                .invalidateQueries({
                                    queryKey: ['user-me'],
                                })
                                .then()
                        } finally {
                            setLagrer(false)
                        }
                    }}
                >
                    <div>
                        <TextField
                            label="Hvilken spiller scorer flest mål?"
                            disabled={erEtterFørsteRunde()}
                            value={topscorer}
                            description={
                                'Kan endres frem til ' + førsteRunde.locale('nb').format('dddd D MMM  kl HH:mm')
                            }
                            onChange={(e) => {
                                setTopscorer(e.target.value)
                            }}
                        />

                        <div>
                            {topscorer != megselv.topscorer && (
                                <Button
                                    className={'mt-4'}
                                    onClick={async () => {}}
                                    loading={lagrer}
                                    icon={<FloppydiskIcon />}
                                >
                                    Lagre
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </div>

            <div>
                <NextLink passHref legacyBehavior href={'/my-bets'}>
                    <LinkPanel className={'rounded-xl shadow border-0 text-xl'} href={'/my-bets'}>
                        Kamper
                    </LinkPanel>
                </NextLink>
            </div>
        </div>
    )
}

export default Home
