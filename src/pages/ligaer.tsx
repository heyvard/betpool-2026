import type { NextPage } from 'next'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import NextLink from 'next/link'
import { Mail, Plus, Search, Users, X } from 'lucide-react'

import { Spinner } from '../components/loading/Spinner'
import { UseLeagues } from '../queries/useLeagues'
import { UseUser } from '../queries/useUser'
import { UseCreateLeague } from '../queries/mutateLeague'
import { UseRespondInvitation } from '../queries/mutateLeagueMember'
import { UseInvitableUsers } from '../queries/useInvitableUsers'
import { InvitableUser, LeagueSummary } from '../types/league'
import { LinkPanel } from '@/components/ui/link-panel'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { TextField } from '@/components/ui/text-field'
import { PremieInputs, ProsentState } from '../components/PremieInputs'
import { cn } from '@/lib/utils'
import { useLanguage } from '../i18n/LanguageContext'
import { tx } from '../i18n/interpolate'
import { UseHovedliga } from '../queries/useHovedliga'
import { UseMutateHovedliga } from '../queries/mutateHovedliga'
import { useAuthedFetch } from '../auth/authedFetch'

const Ligaer: NextPage = () => {
    const { data: ligaer } = UseLeagues()
    const { data: megselv } = UseUser()
    const { t } = useLanguage()

    if (!ligaer || !megselv) {
        return <Spinner />
    }

    const invitasjoner = ligaer.filter((l) => l.my_status === 'invitert')
    const mine = ligaer.filter((l) => l.my_status === 'medlem')

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-stone-900">{t.ligaer.tittel}</h1>
            <p className="-mt-4 text-sm text-stone-500">{t.ligaer.beskrivelse}</p>

            <HovedligaKort iHovedliga={megselv.i_hovedliga} />

            {invitasjoner.length > 0 && (
                <section className="space-y-2">
                    <h2 className="bp-overline">{t.ligaer.invitasjoner}</h2>
                    {invitasjoner.map((liga) => (
                        <InvitasjonsKort key={liga.id} liga={liga} megId={megselv.id} />
                    ))}
                </section>
            )}

            <section className="space-y-2">
                <h2 className="bp-overline">{t.ligaer.ligaeneDine}</h2>
                {mine.length === 0 ? (
                    <p className="rounded-xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-500 ring-1 ring-stone-200/70">
                        {t.ligaer.ingenLigaer}
                    </p>
                ) : (
                    mine.map((liga) => (
                        <NextLink key={liga.id} passHref legacyBehavior href={'/ligaer/' + liga.id}>
                            <LinkPanel>
                                <span className="flex flex-col">
                                    <span className="text-base font-semibold text-stone-900">{liga.name}</span>
                                    <span className="flex items-center gap-1 text-xs text-stone-500">
                                        <Users className="h-3.5 w-3.5" />
                                        {tx(t.ligaer.antallMedlemmer, { antall: liga.member_count })}
                                        {liga.innsats != null && ` · ${liga.innsats} ${t.felles.kr} i innsats`}
                                        {liga.is_owner && ` ${t.ligaer.duErVert}`}
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

function HovedligaKort({ iHovedliga }: { iHovedliga: boolean }) {
    const { t } = useLanguage()
    const hovedliga = UseHovedliga()
    const settHovedliga = UseMutateHovedliga()

    return (
        <div className="bp-card space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="bp-overline">{t.hovedliga.overskrift}</p>
                    <p className="mt-1 text-sm font-medium text-stone-900">{t.hovedliga.bryter}</p>
                </div>
                <Switch
                    checked={iHovedliga}
                    onCheckedChange={(v) => settHovedliga.mutate(v)}
                    disabled={settHovedliga.isPending}
                    aria-label={t.hovedliga.bryter}
                />
            </div>
            {hovedliga.data && (
                <p className="text-sm font-medium text-stone-700">
                    {tx(t.hovedliga.pottOgPris, { pott: hovedliga.data.pott, pris: hovedliga.data.pris })}
                </p>
            )}
            <p className="text-xs text-stone-500">{iHovedliga ? t.hovedliga.medInfo : t.hovedliga.ikkeMedInfo}</p>
        </div>
    )
}

function InvitasjonsKort({ liga, megId }: { liga: LeagueSummary; megId: string }) {
    const { mutate, isPending } = UseRespondInvitation()
    const { t } = useLanguage()

    const svar = (accept: boolean) => {
        mutate({ leagueId: liga.id, userId: megId, accept })
    }

    return (
        <div className="bp-card">
            <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <Mail className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900">{liga.name}</p>
                    <p className="text-xs text-stone-500">
                        {tx(t.ligaer.invitasjonsKortInvitert, { navn: liga.owner_name })}
                        {liga.innsats != null && ` · ${liga.innsats} ${t.felles.kr} i innsats`}
                    </p>
                </div>
            </div>
            <div className="mt-3 flex gap-2">
                <Button variant="accent" size="small" loading={isPending} onClick={() => svar(true)}>
                    {t.ligaer.takkJa}
                </Button>
                <Button variant="ghost" size="small" disabled={isPending} onClick={() => svar(false)}>
                    {t.ligaer.takkNei}
                </Button>
            </div>
        </div>
    )
}

function NyLigaSkjema() {
    const router = useRouter()
    const { mutate, isPending, error } = UseCreateLeague()
    const { t } = useLanguage()
    const authedFetch = useAuthedFetch()
    const [navn, setNavn] = useState('')
    const [innsats, setInnsats] = useState('')
    const [betalingsinfo, setBetalingsinfo] = useState('')
    const [prosenter, setProsenter] = useState<ProsentState>({ forste: '', andre: '', tredje: '' })
    const [valgtePersoner, setValgtePersoner] = useState<InvitableUser[]>([])

    const summer =
        (parseInt(prosenter.forste, 10) || 0) +
        (parseInt(prosenter.andre, 10) || 0) +
        (parseInt(prosenter.tredje, 10) || 0)
    const ugyldigSum = summer > 100

    const opprett = (e: React.FormEvent) => {
        e.preventDefault()
        if (navn.trim() === '' || ugyldigSum) return
        mutate(
            {
                name: navn.trim(),
                innsats: innsats.trim() === '' ? null : Number(innsats),
                betalingsinfo: betalingsinfo.trim() === '' ? null : betalingsinfo.trim(),
                premie_forste_prosent: parseInt(prosenter.forste, 10) || 0,
                premie_andre_prosent: parseInt(prosenter.andre, 10) || 0,
                premie_tredje_prosent: parseInt(prosenter.tredje, 10) || 0,
            },
            {
                onSuccess: async (data) => {
                    await Promise.all(
                        valgtePersoner.map((p) =>
                            authedFetch(`/api/v1/leagues/${data.id}/members`, {
                                method: 'POST',
                                body: JSON.stringify({ user_id: p.id }),
                            }),
                        ),
                    )
                    router.push('/ligaer/' + data.id)
                },
            },
        )
    }

    return (
        <section className="space-y-2">
            <h2 className="bp-overline">{t.ligaer.lagNyLiga}</h2>
            <form onSubmit={opprett} className="bp-card space-y-3">
                <TextField
                    label={t.ligaer.navnPaaLigaen}
                    value={navn}
                    onChange={(e) => setNavn(e.target.value)}
                    placeholder={t.ligaer.navnPlaceholder}
                    maxLength={100}
                />
                <TextField
                    label={t.ligaer.innsatsLabel}
                    description={t.ligaer.innsatsBeskrivelse}
                    type="number"
                    min={0}
                    value={innsats}
                    onChange={(e) => setInnsats(e.target.value)}
                    placeholder={t.ligaer.innsatsPlaceholder}
                />
                <div className="flex flex-col gap-1">
                    <label htmlFor="betalingsinfo" className="text-sm font-medium text-stone-700">
                        {t.ligaer.betalingsinfoLabel}
                    </label>
                    <p className="text-xs text-stone-500">{t.ligaer.betalingsinfoBeskrivelse}</p>
                    <textarea
                        id="betalingsinfo"
                        value={betalingsinfo}
                        onChange={(e) => setBetalingsinfo(e.target.value)}
                        placeholder={t.ligaer.betalingsinfoPlaceholder}
                        rows={3}
                        className={cn(
                            'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-hidden transition-shadow',
                            'placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-400',
                        )}
                    />
                </div>
                <PremieInputs
                    verdier={prosenter}
                    onChange={(felt, verdi) => setProsenter((p) => ({ ...p, [felt]: verdi }))}
                />
                <BrukerVelger valgte={valgtePersoner} onChange={setValgtePersoner} />
                {error && <p className="text-sm text-red-600">{error.message}</p>}
                <Button
                    type="submit"
                    variant="accent"
                    loading={isPending}
                    disabled={navn.trim() === '' || ugyldigSum}
                    icon={<Plus className="h-4 w-4" />}
                >
                    {t.ligaer.opprettLiga}
                </Button>
            </form>
        </section>
    )
}

function BrukerVelger({ valgte, onChange }: { valgte: InvitableUser[]; onChange: (v: InvitableUser[]) => void }) {
    const { t } = useLanguage()
    const { data: brukere } = UseInvitableUsers()
    const [sok, setSok] = useState('')

    const valgteIder = new Set(valgte.map((p) => p.id))

    const filtrert = (brukere ?? []).filter(
        (b) => !valgteIder.has(b.id) && b.name.toLowerCase().includes(sok.toLowerCase()),
    )

    const leggTil = (bruker: InvitableUser) => {
        onChange([...valgte, bruker])
        setSok('')
    }

    const fjern = (id: string) => onChange(valgte.filter((p) => p.id !== id))

    return (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-stone-700">{t.ligaer.inviterPersoner}</label>
            <p className="text-xs text-stone-500">{t.ligaer.inviterPersonerBeskrivelse}</p>

            {valgte.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {valgte.map((p) => (
                        <span
                            key={p.id}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900"
                        >
                            {p.name}
                            <button
                                type="button"
                                onClick={() => fjern(p.id)}
                                aria-label={tx(t.ligaer.fjernValgt, { navn: p.name })}
                                className="rounded-full text-amber-700 hover:text-amber-900"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                    type="text"
                    value={sok}
                    onChange={(e) => setSok(e.target.value)}
                    placeholder={t.ligaer.sokBruker}
                    className={cn(
                        'w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm outline-hidden transition-shadow',
                        'placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-400',
                    )}
                />
            </div>

            {sok.trim() !== '' && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-sm">
                    {filtrert.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-stone-400">{t.ligaer.ingenBrukere}</p>
                    ) : (
                        filtrert.map((b) => (
                            <button
                                key={b.id}
                                type="button"
                                onClick={() => leggTil(b)}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-amber-50"
                            >
                                {b.picture ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={b.picture}
                                        alt=""
                                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                                    />
                                ) : (
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-500">
                                        {b.name.charAt(0).toUpperCase()}
                                    </span>
                                )}
                                <span className="truncate font-medium text-stone-900">{b.name}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
