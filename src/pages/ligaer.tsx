import type { NextPage } from 'next'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import NextLink from 'next/link'
import { Mail, Plus, Users } from 'lucide-react'

import { Spinner } from '../components/loading/Spinner'
import { UseLeagues } from '../queries/useLeagues'
import { UseUser } from '../queries/useUser'
import { UseCreateLeague } from '../queries/mutateLeague'
import { UseRespondInvitation } from '../queries/mutateLeagueMember'
import { LeagueSummary } from '../types/league'
import { LinkPanel } from '@/components/ui/link-panel'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { cn } from '@/lib/utils'

const Ligaer: NextPage = () => {
    const { data: ligaer } = UseLeagues()
    const { data: megselv } = UseUser()

    if (!ligaer || !megselv) {
        return <Spinner />
    }

    const invitasjoner = ligaer.filter((l) => l.my_status === 'invitert')
    const mine = ligaer.filter((l) => l.my_status === 'medlem')

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-stone-900">Mine ligaer</h1>
            <p className="-mt-4 text-sm text-stone-500">
                Private ligaer bruker de samme poengene som hovedligaen — du konkurrerer bare i en mindre gjeng med egen
                innsats.
            </p>

            {invitasjoner.length > 0 && (
                <section className="space-y-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Invitasjoner</h2>
                    {invitasjoner.map((liga) => (
                        <InvitasjonsKort key={liga.id} liga={liga} megId={megselv.id} />
                    ))}
                </section>
            )}

            <section className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Ligaene dine</h2>
                {mine.length === 0 ? (
                    <p className="rounded-xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-500 ring-1 ring-stone-200/70">
                        Du er ikke med i noen private ligaer ennå.
                    </p>
                ) : (
                    mine.map((liga) => (
                        <NextLink key={liga.id} passHref legacyBehavior href={'/ligaer/' + liga.id}>
                            <LinkPanel>
                                <span className="flex flex-col">
                                    <span className="text-base font-semibold text-stone-900">{liga.name}</span>
                                    <span className="flex items-center gap-1 text-xs text-stone-500">
                                        <Users className="h-3.5 w-3.5" />
                                        {liga.member_count} medlemmer
                                        {liga.innsats != null && ` · ${liga.innsats} kr i innsats`}
                                        {liga.is_owner && ' · du er vert'}
                                    </span>
                                </span>
                            </LinkPanel>
                        </NextLink>
                    ))
                )}
            </section>

            <NyLigaSkjema />
        </div>
    )
}

export default Ligaer

/** Én ventende invitasjon med takk ja / takk nei. */
function InvitasjonsKort({ liga, megId }: { liga: LeagueSummary; megId: string }) {
    const { mutate, isPending } = UseRespondInvitation()

    const svar = (accept: boolean) => {
        mutate({ leagueId: liga.id, userId: megId, accept })
    }

    return (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
            <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <Mail className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900">{liga.name}</p>
                    <p className="text-xs text-stone-500">
                        Invitert av {liga.owner_name}
                        {liga.innsats != null && ` · ${liga.innsats} kr i innsats`}
                    </p>
                </div>
            </div>
            <div className="mt-3 flex gap-2">
                <Button variant="accent" size="small" loading={isPending} onClick={() => svar(true)}>
                    Takk ja
                </Button>
                <Button variant="ghost" size="small" disabled={isPending} onClick={() => svar(false)}>
                    Takk nei
                </Button>
            </div>
        </div>
    )
}

/** Skjema for å opprette en ny privat liga. Oppretteren blir vert og medlem. */
function NyLigaSkjema() {
    const router = useRouter()
    const { mutate, isPending, error } = UseCreateLeague()
    const [navn, setNavn] = useState('')
    const [innsats, setInnsats] = useState('')
    const [betalingsinfo, setBetalingsinfo] = useState('')

    const opprett = (e: React.FormEvent) => {
        e.preventDefault()
        if (navn.trim() === '') return
        mutate(
            {
                name: navn.trim(),
                innsats: innsats.trim() === '' ? null : Number(innsats),
                betalingsinfo: betalingsinfo.trim() === '' ? null : betalingsinfo.trim(),
            },
            { onSuccess: (data) => router.push('/ligaer/' + data.id) },
        )
    }

    return (
        <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Lag ny liga</h2>
            <form onSubmit={opprett} className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
                <TextField
                    label="Navn på ligaen"
                    value={navn}
                    onChange={(e) => setNavn(e.target.value)}
                    placeholder="F.eks. Gutta på jobben"
                    maxLength={100}
                />
                <TextField
                    label="Innsats (kr)"
                    description="Valgfritt. Du holder selv styr på innbetalingene."
                    type="number"
                    min={0}
                    value={innsats}
                    onChange={(e) => setInnsats(e.target.value)}
                    placeholder="F.eks. 200"
                />
                <div className="flex flex-col gap-1">
                    <label htmlFor="betalingsinfo" className="text-sm font-medium text-stone-700">
                        Betalingsinfo
                    </label>
                    <p className="text-xs text-stone-500">Valgfritt. Hvor og hvordan medlemmene skal betale inn.</p>
                    <textarea
                        id="betalingsinfo"
                        value={betalingsinfo}
                        onChange={(e) => setBetalingsinfo(e.target.value)}
                        placeholder="F.eks. Vipps 200 kr til 123 45 678 før første kamp."
                        rows={3}
                        className={cn(
                            'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-shadow',
                            'placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-400',
                        )}
                    />
                </div>
                {error && <p className="text-sm text-red-600">{error.message}</p>}
                <Button
                    type="submit"
                    variant="accent"
                    loading={isPending}
                    disabled={navn.trim() === ''}
                    icon={<Plus className="h-4 w-4" />}
                >
                    Opprett liga
                </Button>
            </form>
        </section>
    )
}
