import type { NextPage } from 'next'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import NextLink from 'next/link'
import { ArrowLeft, Banknote, Check, Clock, LogOut, Trash2, UserPlus } from 'lucide-react'

import { Spinner } from '../../components/loading/Spinner'
import { UseLeague } from '../../queries/useLeague'
import { UseUser } from '../../queries/useUser'
import { UseInvitableUsers } from '../../queries/useInvitableUsers'
import { UseDeleteLeague, UseUpdateLeague } from '../../queries/mutateLeague'
import { UseInviteMember, UseRemoveMember, UseSetMemberPaid } from '../../queries/mutateLeagueMember'
import { LeagueDetail, LeagueMember } from '../../types/league'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { TextField } from '@/components/ui/text-field'
import { PremieKort } from '../../components/PremieKort'
import { PremieInputs, ProsentState } from '../../components/PremieInputs'
import { cn } from '@/lib/utils'

const LigaSide: NextPage = () => {
    const router = useRouter()
    const id = typeof router.query.id === 'string' ? router.query.id : null
    const { data: liga, isLoading, isError } = UseLeague(id)
    const { data: megselv } = UseUser()

    if (!id || isLoading || !megselv) {
        return <Spinner />
    }
    if (isError || !liga) {
        return (
            <div className="space-y-4">
                <TilbakeLenke />
                <p className="rounded-xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-500 ring-1 ring-stone-200/70">
                    Fant ikke ligaen, eller du har ikke tilgang til den.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <TilbakeLenke />
            <h1 className="text-2xl font-bold text-stone-900">{liga.name}</h1>

            <InnsatsKort liga={liga} />
            <PremieKort liga={liga} antallMedlemmer={liga.members.filter((m) => m.status === 'medlem').length} />
            <MedlemsSeksjon liga={liga} />
            {liga.is_owner && <InviterSeksjon liga={liga} />}
            {liga.is_owner && <RedigerSeksjon liga={liga} />}
            <FarligSone liga={liga} megId={megselv.id} />
        </div>
    )
}

export default LigaSide

function TilbakeLenke() {
    return (
        <NextLink href="/ligaer" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="h-4 w-4" />
            Mine ligaer
        </NextLink>
    )
}

/** Innsats, betalingsinfo og hvem som er vert. */
function InnsatsKort({ liga }: { liga: LeagueDetail }) {
    return (
        <div className="bp-card">
            <p className="text-xs text-stone-500">Ligavert: {liga.owner_name}</p>
            {liga.innsats != null && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-stone-800">
                    <Banknote className="h-4 w-4 text-stone-400" />
                    Innsats: {liga.innsats} kr
                </p>
            )}
            {liga.betalingsinfo ? (
                <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{liga.betalingsinfo}</p>
            ) : (
                <p className="mt-1 text-sm text-stone-400">Ingen betalingsinfo lagt inn.</p>
            )}
        </div>
    )
}

/** Medlemsliste. Verten kan toggle betalt-status og fjerne medlemmer. */
function MedlemsSeksjon({ liga }: { liga: LeagueDetail }) {
    const setPaid = UseSetMemberPaid(liga.id)
    const removeMember = UseRemoveMember(liga.id)

    return (
        <section className="space-y-2">
            <h2 className="bp-overline">Medlemmer ({liga.members.filter((m) => m.status === 'medlem').length})</h2>
            <div className="divide-y divide-stone-100 rounded-xl bg-white shadow-xs ring-1 ring-stone-200/70">
                {liga.members.map((m) => (
                    <MedlemsRad
                        key={m.user_id}
                        medlem={m}
                        erVert={liga.is_owner}
                        erEier={m.user_id === liga.owner_user_id}
                        onTogglePaid={() => setPaid.mutate({ userId: m.user_id, paid: !m.paid })}
                        paidPending={setPaid.isPending}
                        onRemove={() => {
                            if (window.confirm(`Fjerne ${m.name} fra ligaen?`)) {
                                removeMember.mutate(m.user_id)
                            }
                        }}
                        removePending={removeMember.isPending}
                    />
                ))}
            </div>
        </section>
    )
}

function MedlemsRad({
    medlem,
    erVert,
    erEier,
    onTogglePaid,
    paidPending,
    onRemove,
    removePending,
}: {
    medlem: LeagueMember
    erVert: boolean
    erEier: boolean
    onTogglePaid: () => void
    paidPending: boolean
    onRemove: () => void
    removePending: boolean
}) {
    const invitert = medlem.status === 'invitert'
    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-stone-900">{medlem.name}</span>
                    {erEier && (
                        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                            Vert
                        </span>
                    )}
                    {invitert && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            Invitert
                        </span>
                    )}
                </div>
                {!invitert && (
                    <span
                        className={cn(
                            'mt-0.5 inline-flex items-center gap-1 text-xs font-medium',
                            medlem.paid ? 'text-emerald-700' : 'text-amber-700',
                        )}
                    >
                        {medlem.paid ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {medlem.paid ? 'Betalt' : 'Ikke betalt'}
                    </span>
                )}
            </div>

            {erVert && !invitert && (
                <Switch checked={medlem.paid} size="small" loading={paidPending} onCheckedChange={onTogglePaid} />
            )}
            {erVert && !erEier && (
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={removePending}
                    aria-label={`Fjern ${medlem.name}`}
                    className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            )}
        </div>
    )
}

/** Verten inviterer en bruker som ikke allerede er medlem/invitert. */
function InviterSeksjon({ liga }: { liga: LeagueDetail }) {
    const { data: brukere } = UseInvitableUsers()
    const invite = UseInviteMember(liga.id)
    const [valgt, setValgt] = useState('')

    const alleredeMed = new Set(liga.members.map((m) => m.user_id))
    const tilgjengelige = (brukere ?? []).filter((u) => !alleredeMed.has(u.id))

    const inviter = () => {
        if (!valgt) return
        invite.mutate(valgt, { onSuccess: () => setValgt('') })
    }

    return (
        <section className="space-y-2">
            <h2 className="bp-overline">Inviter medlem</h2>
            <div className="bp-card space-y-3">
                {tilgjengelige.length === 0 ? (
                    <p className="text-sm text-stone-500">Alle aktive brukere er allerede med eller invitert.</p>
                ) : (
                    <>
                        <div className="flex flex-col gap-1">
                            <label htmlFor="inviter-bruker" className="sr-only">
                                Velg bruker
                            </label>
                            <select
                                id="inviter-bruker"
                                value={valgt}
                                onChange={(e) => setValgt(e.target.value)}
                                className={cn(
                                    'h-9 rounded-lg border border-stone-300 bg-white px-3 text-sm transition-shadow',
                                    'focus:border-amber-500 focus:outline-hidden focus:ring-2 focus:ring-amber-400',
                                )}
                            >
                                <option value="">Velg bruker …</option>
                                {tilgjengelige.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {invite.error && <p className="text-sm text-red-600">{invite.error.message}</p>}
                        <Button
                            variant="accent"
                            loading={invite.isPending}
                            disabled={!valgt}
                            onClick={inviter}
                            icon={<UserPlus className="h-4 w-4" />}
                        >
                            Send invitasjon
                        </Button>
                    </>
                )}
            </div>
        </section>
    )
}

/** Verten endrer navn, innsats, betalingsinfo og premiefordeling. */
function RedigerSeksjon({ liga }: { liga: LeagueDetail }) {
    const { mutate, isPending, error, isSuccess } = UseUpdateLeague(liga.id)
    const [navn, setNavn] = useState(liga.name)
    const [innsats, setInnsats] = useState(liga.innsats != null ? String(liga.innsats) : '')
    const [betalingsinfo, setBetalingsinfo] = useState(liga.betalingsinfo ?? '')
    const [prosenter, setProsenter] = useState<ProsentState>({
        forste: liga.premie_forste_prosent ? String(liga.premie_forste_prosent) : '',
        andre: liga.premie_andre_prosent ? String(liga.premie_andre_prosent) : '',
        tredje: liga.premie_tredje_prosent ? String(liga.premie_tredje_prosent) : '',
    })

    const summer =
        (parseInt(prosenter.forste, 10) || 0) +
        (parseInt(prosenter.andre, 10) || 0) +
        (parseInt(prosenter.tredje, 10) || 0)
    const ugyldigSum = summer > 100

    const lagre = (e: React.FormEvent) => {
        e.preventDefault()
        if (navn.trim() === '' || ugyldigSum) return
        mutate({
            name: navn.trim(),
            innsats: innsats.trim() === '' ? null : Number(innsats),
            betalingsinfo: betalingsinfo.trim() === '' ? null : betalingsinfo.trim(),
            premie_forste_prosent: parseInt(prosenter.forste, 10) || 0,
            premie_andre_prosent: parseInt(prosenter.andre, 10) || 0,
            premie_tredje_prosent: parseInt(prosenter.tredje, 10) || 0,
        })
    }

    return (
        <section className="space-y-2">
            <h2 className="bp-overline">Innstillinger</h2>
            <form onSubmit={lagre} className="bp-card space-y-3">
                <TextField
                    label="Navn på ligaen"
                    value={navn}
                    onChange={(e) => setNavn(e.target.value)}
                    maxLength={100}
                />
                <TextField
                    label="Innsats (kr)"
                    type="number"
                    min={0}
                    value={innsats}
                    onChange={(e) => setInnsats(e.target.value)}
                    placeholder="Ingen innsats"
                />
                <div className="flex flex-col gap-1">
                    <label htmlFor="rediger-betalingsinfo" className="text-sm font-medium text-stone-700">
                        Betalingsinfo
                    </label>
                    <textarea
                        id="rediger-betalingsinfo"
                        value={betalingsinfo}
                        onChange={(e) => setBetalingsinfo(e.target.value)}
                        placeholder="Hvor og hvordan medlemmene skal betale inn."
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
                {error && <p className="text-sm text-red-600">{error.message}</p>}
                {isSuccess && !isPending && <p className="text-sm font-medium text-emerald-700">Lagret</p>}
                <Button type="submit" loading={isPending} disabled={navn.trim() === '' || ugyldigSum}>
                    Lagre endringer
                </Button>
            </form>
        </section>
    )
}

/** Forlat ligaen (medlem) eller slett den (vert). */
function FarligSone({ liga, megId }: { liga: LeagueDetail; megId: string }) {
    const router = useRouter()
    const removeMember = UseRemoveMember(liga.id)
    const deleteLeague = UseDeleteLeague(liga.id)

    const forlat = () => {
        if (window.confirm(`Forlate «${liga.name}»?`)) {
            removeMember.mutate(megId, { onSuccess: () => router.push('/ligaer') })
        }
    }
    const slett = () => {
        if (window.confirm(`Slette «${liga.name}»? Dette kan ikke angres.`)) {
            deleteLeague.mutate(undefined, { onSuccess: () => router.push('/ligaer') })
        }
    }

    return (
        <section className="space-y-2">
            {liga.is_owner ? (
                <Button
                    variant="outline"
                    loading={deleteLeague.isPending}
                    onClick={slett}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    icon={<Trash2 className="h-4 w-4" />}
                >
                    Slett ligaen
                </Button>
            ) : (
                <Button
                    variant="outline"
                    loading={removeMember.isPending}
                    onClick={forlat}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    icon={<LogOut className="h-4 w-4" />}
                >
                    Forlat ligaen
                </Button>
            )}
        </section>
    )
}
