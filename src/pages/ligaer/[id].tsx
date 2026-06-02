import type { NextPage } from 'next'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import NextLink from 'next/link'
import { ArrowLeft, Banknote, Check, Clock, Copy, LogOut, Share2, Trash2 } from 'lucide-react'

import { Spinner } from '../../components/loading/Spinner'
import { UseLeague } from '../../queries/useLeague'
import { UseUser } from '../../queries/useUser'
import { UseDeleteLeague, UseUpdateLeague } from '../../queries/mutateLeague'
import { UseRemoveMember, UseSetMemberPaid } from '../../queries/mutateLeagueMember'
import { LeagueDetail, LeagueMember } from '../../types/league'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { TextField } from '@/components/ui/text-field'
import { PremieKort } from '../../components/PremieKort'
import { PremieInputs, ProsentState } from '../../components/PremieInputs'
import { cn } from '@/lib/utils'
import { useLanguage } from '../../i18n/LanguageContext'
import { tx } from '../../i18n/interpolate'

const LigaSide: NextPage = () => {
    const router = useRouter()
    const id = typeof router.query.id === 'string' ? router.query.id : null
    const { data: liga, isLoading, isError } = UseLeague(id)
    const { data: megselv } = UseUser()
    const { t } = useLanguage()

    if (!id || isLoading || !megselv) {
        return <Spinner />
    }
    if (isError || !liga) {
        return (
            <div className="space-y-4">
                <TilbakeLenke />
                <p className="rounded-xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-500 ring-1 ring-stone-200/70">
                    {t.ligaSide.fantIkke}
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
            <DelLenkeSeksjon liga={liga} />
            {liga.is_owner && <RedigerSeksjon liga={liga} />}
            <FarligSone liga={liga} megId={megselv.id} />
        </div>
    )
}

export default LigaSide

function TilbakeLenke() {
    const { t } = useLanguage()
    return (
        <NextLink href="/ligaer" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="h-4 w-4" />
            {t.ligaSide.tilbake}
        </NextLink>
    )
}

function InnsatsKort({ liga }: { liga: LeagueDetail }) {
    const { t } = useLanguage()
    return (
        <div className="bp-card">
            <p className="text-xs text-stone-500">{tx(t.ligaSide.ligavert, { navn: liga.owner_name })}</p>
            {liga.innsats != null && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-stone-800">
                    <Banknote className="h-4 w-4 text-stone-400" />
                    {tx(t.ligaSide.innsats, { kr: liga.innsats })}
                </p>
            )}
            {liga.betalingsinfo ? (
                <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{liga.betalingsinfo}</p>
            ) : (
                <p className="mt-1 text-sm text-stone-400">{t.ligaSide.ingenBetalingsinfo}</p>
            )}
        </div>
    )
}

function MedlemsSeksjon({ liga }: { liga: LeagueDetail }) {
    const setPaid = UseSetMemberPaid(liga.id)
    const removeMember = UseRemoveMember(liga.id)
    const { t } = useLanguage()

    return (
        <section className="space-y-2">
            <h2 className="bp-overline">
                {tx(t.ligaSide.medlemmer, { antall: liga.members.filter((m) => m.status === 'medlem').length })}
            </h2>
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
                            if (window.confirm(tx(t.ligaSide.fjernMedlem, { navn: m.name }))) {
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
    const { t } = useLanguage()
    const invitert = medlem.status === 'invitert'
    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-stone-900">{medlem.name}</span>
                    {erEier && (
                        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                            {t.felles.vert}
                        </span>
                    )}
                    {invitert && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            {t.felles.invitert}
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
                        {medlem.paid ? t.felles.betalt : t.felles.ikkeBetalt}
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
                    aria-label={tx(t.ligaSide.fjernMedlem, { navn: medlem.name })}
                    className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            )}
        </div>
    )
}

function DelLenkeSeksjon({ liga }: { liga: LeagueDetail }) {
    const { t } = useLanguage()
    const [kopiert, setKopiert] = useState(false)

    // window finnes ikke ved SSR — bygg lenken først på klienten.
    const lenke = typeof window !== 'undefined' ? `${window.location.origin}/bli-med/${liga.invite_token}` : ''
    const kanDele = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

    const kopier = async () => {
        try {
            await navigator.clipboard.writeText(lenke)
        } catch {
            // clipboard kan være utilgjengelig (ikke-https / eldre nettlesere) — vis likevel feedback
        }
        setKopiert(true)
        setTimeout(() => setKopiert(false), 2000)
    }

    const del = async () => {
        try {
            await navigator.share({ title: liga.name, url: lenke })
        } catch {
            // brukeren avbrøt delingen — ingen handling
        }
    }

    return (
        <section className="space-y-2">
            <h2 className="bp-overline">{t.ligaSide.delLenke}</h2>
            <div className="bp-card space-y-3">
                <p className="text-sm text-stone-500">{t.ligaSide.delLenkeForklaring}</p>
                <input
                    type="text"
                    readOnly
                    value={lenke}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={t.ligaSide.delLenke}
                    className={cn(
                        'w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-700',
                        'outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-400',
                    )}
                />
                <div className="flex gap-2">
                    <Button
                        variant="accent"
                        onClick={kopier}
                        icon={kopiert ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    >
                        {kopiert ? t.ligaSide.lenkeKopiert : t.ligaSide.kopierLenke}
                    </Button>
                    {kanDele && (
                        <Button variant="ghost" onClick={del} icon={<Share2 className="h-4 w-4" />}>
                            {t.ligaSide.delKnapp}
                        </Button>
                    )}
                </div>
            </div>
        </section>
    )
}

function RedigerSeksjon({ liga }: { liga: LeagueDetail }) {
    const { mutate, isPending, error, isSuccess } = UseUpdateLeague(liga.id)
    const { t } = useLanguage()
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
            <h2 className="bp-overline">{t.ligaSide.innstillinger}</h2>
            <form onSubmit={lagre} className="bp-card space-y-3">
                <TextField
                    label={t.ligaer.navnPaaLigaen}
                    value={navn}
                    onChange={(e) => setNavn(e.target.value)}
                    maxLength={100}
                />
                <TextField
                    label={t.ligaer.innsatsLabel}
                    type="number"
                    min={0}
                    value={innsats}
                    onChange={(e) => setInnsats(e.target.value)}
                    placeholder={t.ligaSide.ingenInnsats}
                />
                <div className="flex flex-col gap-1">
                    <label htmlFor="rediger-betalingsinfo" className="text-sm font-medium text-stone-700">
                        {t.ligaSide.betalingsinfo}
                    </label>
                    <textarea
                        id="rediger-betalingsinfo"
                        value={betalingsinfo}
                        onChange={(e) => setBetalingsinfo(e.target.value)}
                        placeholder={t.ligaSide.betalingsinfoBeskrivelse}
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
                {isSuccess && !isPending && <p className="text-sm font-medium text-emerald-700">{t.felles.lagret}</p>}
                <Button type="submit" loading={isPending} disabled={navn.trim() === '' || ugyldigSum}>
                    {t.ligaSide.lagreEndringer}
                </Button>
            </form>
        </section>
    )
}

function FarligSone({ liga, megId }: { liga: LeagueDetail; megId: string }) {
    const router = useRouter()
    const removeMember = UseRemoveMember(liga.id)
    const deleteLeague = UseDeleteLeague(liga.id)
    const { t } = useLanguage()

    const forlat = () => {
        if (window.confirm(tx(t.ligaSide.forlatBekreft, { navn: liga.name }))) {
            removeMember.mutate(megId, { onSuccess: () => router.push('/ligaer') })
        }
    }
    const slett = () => {
        if (window.confirm(tx(t.ligaSide.slettBekreft, { navn: liga.name }))) {
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
                    {t.ligaSide.slettLiga}
                </Button>
            ) : (
                <Button
                    variant="outline"
                    loading={removeMember.isPending}
                    onClick={forlat}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    icon={<LogOut className="h-4 w-4" />}
                >
                    {t.ligaSide.forlatLiga}
                </Button>
            )}
        </section>
    )
}
