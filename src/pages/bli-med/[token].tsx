import type { NextPage } from 'next'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import NextLink from 'next/link'
import { ArrowLeft, Check, Trophy, Users } from 'lucide-react'

import { Spinner } from '../../components/loading/Spinner'
import { UseLeagueInvite } from '../../queries/useLeagueInvite'
import { UseJoinLeague } from '../../queries/mutateJoinLeague'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { fjernPendingInvite } from '../../utils/pendingInvite'
import { useLanguage } from '../../i18n/LanguageContext'
import { tx } from '../../i18n/interpolate'
import { UseHovedliga } from '../../queries/useHovedliga'
import { UseMutateHovedliga } from '../../queries/mutateHovedliga'

const BliMedSide: NextPage = () => {
    const router = useRouter()
    const token = typeof router.query.token === 'string' ? router.query.token : null
    // Satt av _app ved redirect rett etter signup — da tilbys hovedliga-valget.
    const erSignupFlyt = router.query.nybruker === '1'
    const { data: invitasjon, isLoading, isError } = UseLeagueInvite(token)
    const join = UseJoinLeague(token)
    const hovedliga = UseHovedliga()
    const settHovedliga = UseMutateHovedliga()
    const { t } = useLanguage()
    // Standard: bli med i hovedligaen også. Brukeren kan velge den bort her.
    const [medIHovedliga, setMedIHovedliga] = useState(true)

    // Vi har landet på invitasjonen — intent er oppfylt, så den huskes ikke videre.
    useEffect(() => {
        fjernPendingInvite()
    }, [])

    if (!token || isLoading) {
        return <Spinner />
    }

    if (isError || !invitasjon) {
        return (
            <div className="space-y-4">
                <TilbakeLenke />
                <p className="rounded-xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-500 ring-1 ring-stone-200/70">
                    {t.bliMed.ugyldig}
                </p>
            </div>
        )
    }

    const bliMed = () => {
        join.mutate(undefined, {
            onSuccess: async (data) => {
                // Ved signup-flyt: hvis brukeren valgte bort hovedligaen, lagre det
                // før vi navigerer videre. (Default er med, som er DB-standarden.)
                if (erSignupFlyt && !medIHovedliga) {
                    try {
                        await settHovedliga.mutateAsync(false)
                    } catch {
                        // Lar oppmeldingen gå videre selv om dette feiler — kan endres
                        // senere under Mine ligaer.
                    }
                }
                router.replace('/ligaer/' + data.id)
            },
        })
    }

    return (
        <div className="space-y-6">
            <TilbakeLenke />

            <header className="flex flex-col items-center pt-2 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <Trophy className="h-7 w-7" />
                </span>
                <p className="mt-3 bp-overline">{t.bliMed.tittel}</p>
                <h1 className="mt-1 text-2xl font-bold text-stone-900">{invitasjon.name}</h1>
                <p className="mt-1 text-sm text-stone-500">{tx(t.bliMed.ligaAv, { navn: invitasjon.owner_name })}</p>
            </header>

            <div className="bp-card space-y-2 text-sm text-stone-600">
                <p className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-stone-400" />
                    {tx(t.bliMed.antallMedlemmer, { antall: invitasjon.member_count })}
                </p>
                {invitasjon.innsats != null && <p>{tx(t.bliMed.innsats, { kr: invitasjon.innsats })}</p>}
                {invitasjon.betalingsinfo && (
                    <p className="whitespace-pre-line text-stone-500">{invitasjon.betalingsinfo}</p>
                )}
            </div>

            {erSignupFlyt && !invitasjon.already_member && (
                <div className="bp-card space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="bp-overline">{t.hovedliga.overskrift}</p>
                            <p className="mt-1 text-sm font-medium text-stone-900">{t.hovedliga.bliMedSporsmal}</p>
                        </div>
                        <Switch
                            checked={medIHovedliga}
                            onCheckedChange={setMedIHovedliga}
                            aria-label={t.hovedliga.bliMedSporsmal}
                        />
                    </div>
                    {hovedliga.data && (
                        <p className="text-sm font-medium text-stone-700">
                            {tx(t.hovedliga.pottOgPris, {
                                pott: hovedliga.data.pott,
                                pris: hovedliga.data.pris,
                            })}
                        </p>
                    )}
                    <p className="text-xs text-stone-500">{t.hovedliga.bliMedForklaring}</p>
                </div>
            )}

            {invitasjon.already_member ? (
                <div className="space-y-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                        <Check className="h-4 w-4" />
                        {t.bliMed.alleredeMed}
                    </p>
                    <Button variant="accent" onClick={() => router.replace('/ligaer/' + invitasjon.id)}>
                        {t.bliMed.tilLigaen}
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    {join.error && <p className="text-sm text-red-600">{join.error.message}</p>}
                    <Button variant="accent" loading={join.isPending} onClick={bliMed}>
                        {t.bliMed.bliMedKnapp}
                    </Button>
                </div>
            )}
        </div>
    )
}

export default BliMedSide

function TilbakeLenke() {
    const { t } = useLanguage()
    return (
        <NextLink href="/ligaer" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="h-4 w-4" />
            {t.bliMed.tilbake}
        </NextLink>
    )
}
