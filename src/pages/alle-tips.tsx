import type { NextPage } from 'next'
import React, { useState } from 'react'
import NextLink from 'next/link'
import { ArrowLeft, ChevronRight, Goal, Lock, Repeat, Trophy, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { UseUser } from '../queries/useUser'
import { UsePlayers } from '../queries/usePlayers'
import { UseMatches } from '../queries/useMatches'
import { StatsResponse, UseStats } from '../queries/useStats'
import { hentFlag, hentNavn } from '../utils/lag'
import { User } from '../types/user'
import { useLanguage } from '../i18n/LanguageContext'
import { tx } from '../i18n/interpolate'
import { beregnFrister, erEtterFørsteRunde } from '../utils/fristDatoer'
import { nå } from '../utils/testClock'
import { Spinner } from '../components/loading/Spinner'

type Modus = 'vinner' | 'toppscorer'

function initialer(navn: string): string {
    const deler = navn.trim().split(/\s+/).filter(Boolean)
    if (deler.length === 0) return '?'
    if (deler.length === 1) return deler[0].slice(0, 2).toUpperCase()
    return (deler[0][0] + deler[deler.length - 1][0]).toUpperCase()
}

/**
 * Høyest mulige bonus for et tips, gitt hvor mange som har valgt likt. Reglene
 * er de samme som ligger i `t.regler.bonustrapper` — ikke endre tallene her uten
 * å endre dem der.
 */
function muligBonus(antallLike: number, totalt: number): number {
    if (antallLike <= 1) return 25
    const p = (antallLike / totalt) * 100
    if (p < 5) return 18
    if (p < 10) return 12
    if (p < 20) return 8
    if (p < 35) return 5
    return 3
}

/** Normalisert rad uavhengig av modus. */
interface RadData {
    nokkel: string
    flagg: string
    visningsnavn: string
    antall: number
    deltakere: string[]
    /** Delmengde av `deltakere` som har brukt byttet sitt for denne kategorien. */
    byttere: string[]
    erMitt: boolean
}

const AlleTips: NextPage = () => {
    const { t } = useLanguage()
    const { data: megselv } = UseUser()
    const { data: stats, isLoading } = UseStats()
    const [modus, setModus] = useState<Modus>('vinner')

    return (
        <div className="space-y-4">
            <Header modus={modus} />
            <SegmentToggle modus={modus} setModus={setModus} />

            {isLoading || !megselv ? (
                <Spinner />
            ) : !stats ? (
                <TomTilstand tekst={t.allesTips.tomLiga} />
            ) : (
                <ModusVisning modus={modus} stats={stats} megselv={megselv} />
            )}
        </div>
    )
}

export default AlleTips

function Header({ modus }: { modus: Modus }) {
    const { t } = useLanguage()
    const { data: matches } = UseMatches()
    const laast = matches ? erEtterFørsteRunde(beregnFrister(matches), nå()) : false

    return (
        <div>
            <NextLink
                href="/"
                className="mb-2 inline-flex min-h-11 items-center gap-1 text-[12.5px] font-bold text-stone-500"
            >
                <ArrowLeft size={15} /> {t.allesTips.tilbake}
            </NextLink>
            <div className="flex items-center justify-between gap-3">
                <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-[-0.01em] text-stone-900">
                    {modus === 'vinner' ? (
                        <Trophy className="h-5 w-5 text-amber-500" />
                    ) : (
                        <Goal className="h-5 w-5 text-amber-500" />
                    )}
                    {modus === 'vinner' ? t.hjem.verdensmester : t.hjem.toppscorer}
                </h1>
                {laast && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 ring-1 ring-stone-200">
                        <Lock className="h-3 w-3" />
                        {t.hjem.laast}
                    </span>
                )}
            </div>
            <p className="mt-1 text-xs text-stone-500">{tx(t.allesTips.undertittel, { liga: t.allesTips.liganavn })}</p>
        </div>
    )
}

function SegmentToggle({ modus, setModus }: { modus: Modus; setModus: (m: Modus) => void }) {
    const { t } = useLanguage()
    const knapp = (m: Modus, label: string) => (
        <button
            type="button"
            onClick={() => setModus(m)}
            aria-pressed={modus === m}
            className={cn(
                'min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors',
                modus === m ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-700',
            )}
        >
            {label}
        </button>
    )
    return (
        <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
            {knapp('vinner', t.allesTips.toggleVinner)}
            {knapp('toppscorer', t.allesTips.toggleToppscorer)}
        </div>
    )
}

function ModusVisning({ modus, stats, megselv }: { modus: Modus; stats: StatsResponse; megselv: User }) {
    const { t, locale } = useLanguage()
    const { data: spillere } = UsePlayers()

    // Brukerens eget valg som sammenliknbart navn/nøkkel.
    const mittToppscorerNavn =
        spillere?.find((s) => s.id === megselv.topscorer_player_id)?.name ?? megselv.topscorer ?? ''
    const mittValg = modus === 'vinner' ? (megselv.winner ?? '') : mittToppscorerNavn

    const kilde = modus === 'vinner' ? stats.vinner : stats.toppscorer
    const totaltSvar = kilde.reduce((sum, v) => sum + v.antall, 0)

    const rader: RadData[] = [...kilde]
        .sort((a, b) => b.antall - a.antall)
        .map((v) => ({
            nokkel: v.navn,
            flagg: modus === 'vinner' ? hentFlag(v.navn) : '',
            visningsnavn: modus === 'vinner' ? hentNavn(v.navn, locale) : v.navn,
            antall: v.antall,
            deltakere: v.deltakere,
            byttere: v.byttere,
            erMitt: !!mittValg && v.navn === mittValg,
        }))

    const [apenNokkel, setApenNokkel] = useState<string | null>(null)

    if (rader.length === 0) {
        return <TomTilstand tekst={t.allesTips.tomLiga} />
    }

    const mestValgt = rader[0]
    const mittRadIndex = rader.findIndex((r) => r.erMitt)
    const mittRad = mittRadIndex >= 0 ? rader[mittRadIndex] : null
    const totaltByttere = rader.reduce((sum, r) => sum + r.byttere.length, 0)
    const mittTipsByttet = modus === 'vinner' ? megselv.winner_endret : megselv.topscorer_endret

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
                <StatBoks
                    ikon={<Users className="h-3.5 w-3.5" />}
                    verdi={tx(t.allesTips.avTotalt, { antall: totaltSvar, totalt: stats.totaltAntall })}
                    label={t.allesTips.statHarValgt}
                />
                <StatBoks
                    verdi={`${mestValgt.flagg || initialer(mestValgt.visningsnavn)} ${prosent(mestValgt.antall, totaltSvar)}%`}
                    label={t.allesTips.statMestValgt}
                />
                <StatBoks verdi={String(rader.length)} label={t.allesTips.statUlikeTips} />
            </div>

            {totaltByttere > 0 && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                    {tx(t.allesTips.byttereAntall, { n: totaltByttere })}
                </div>
            )}

            <DittTipsKort
                mittRad={mittRad}
                rang={mittRadIndex >= 0 ? mittRadIndex + 1 : null}
                totaltSvar={totaltSvar}
                byttet={mittTipsByttet}
            />

            <ul className="list-none space-y-2">
                {rader.map((rad) => (
                    <FordelingsRad
                        key={rad.nokkel}
                        rad={rad}
                        totaltSvar={totaltSvar}
                        apen={apenNokkel === rad.nokkel}
                        onToggle={() => setApenNokkel((n) => (n === rad.nokkel ? null : rad.nokkel))}
                    />
                ))}
            </ul>

            <p className="px-1 pb-2 text-center text-[11px] leading-relaxed text-stone-400">{t.allesTips.bunntekst}</p>
            {totaltByttere > 0 && (
                <p className="px-1 pb-2 text-center text-[10.5px] leading-relaxed text-stone-400">
                    {t.allesTips.byttetMerkeForklaring}
                </p>
            )}
        </div>
    )
}

function prosent(antall: number, totalt: number): number {
    if (totalt <= 0) return 0
    return Math.round((antall / totalt) * 100)
}

function StatBoks({ ikon, verdi, label }: { ikon?: React.ReactNode; verdi: string; label: string }) {
    return (
        <div className="rounded-2xl bg-white px-2 py-3 text-center shadow-xs ring-1 ring-stone-200/70">
            <p className="flex items-center justify-center gap-1 text-base font-extrabold tabular-nums text-stone-900">
                {ikon && <span className="text-stone-400">{ikon}</span>}
                {verdi}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
        </div>
    )
}

function DittTipsKort({
    mittRad,
    rang,
    totaltSvar,
    byttet,
}: {
    mittRad: RadData | null
    rang: number | null
    totaltSvar: number
    byttet: boolean
}) {
    const { t } = useLanguage()

    if (!mittRad || rang == null) {
        return (
            <div className="rounded-2xl bg-stone-50 px-4 py-4 text-center ring-1 ring-stone-200/70">
                <p className="text-sm font-semibold text-stone-700">{t.allesTips.ingenValgTittel}</p>
                <p className="mt-1 text-xs text-stone-500">{t.allesTips.ingenValgTekst}</p>
                <NextLink
                    href="/"
                    className="mt-2 inline-block text-sm font-semibold text-amber-700 hover:text-amber-800"
                >
                    {t.allesTips.ingenValgLenke}
                </NextLink>
            </div>
        )
    }

    const andre = mittRad.antall - 1
    const delerTekst =
        andre <= 0
            ? t.allesTips.alene
            : andre === 1
              ? t.allesTips.delerMedEn
              : tx(t.allesTips.delerMedAndre, { n: andre })
    const bonus = muligBonus(mittRad.antall, totaltSvar)

    return (
        <div className="rounded-2xl bg-linear-to-br from-amber-50 to-white p-4 ring-1 ring-amber-200">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">{t.allesTips.dittTips}</p>
            <div className="mt-2 flex items-center gap-3">
                <Emblem flagg={mittRad.flagg} navn={mittRad.visningsnavn} stor />
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-base font-extrabold text-stone-900">
                        <span className="truncate">{mittRad.visningsnavn}</span>
                        {byttet && <span className="chip-halved shrink-0">{t.allesTips.byttetMerkeKort}</span>}
                    </p>
                    <p className="text-xs text-stone-500">
                        {tx(t.allesTips.rangering, { n: rang })} · {delerTekst}
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-xl font-extrabold tabular-nums text-amber-700">+{bonus}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/70">
                        {t.allesTips.muligBonus}
                    </p>
                </div>
            </div>
        </div>
    )
}

function FordelingsRad({
    rad,
    totaltSvar,
    apen,
    onToggle,
}: {
    rad: RadData
    totaltSvar: number
    apen: boolean
    onToggle: () => void
}) {
    const { t } = useLanguage()
    const pst = prosent(rad.antall, totaltSvar)
    const synlige = rad.deltakere.slice(0, 4)
    const resterende = rad.deltakere.length - synlige.length

    return (
        <li
            className={cn(
                'overflow-hidden rounded-2xl shadow-xs ring-1',
                rad.erMitt ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-stone-200/70',
            )}
        >
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={apen}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
            >
                <Emblem flagg={rad.flagg} navn={rad.visningsnavn} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-bold text-stone-900">
                            {rad.visningsnavn}
                            {rad.erMitt && (
                                <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 align-middle">
                                    {t.allesTips.deg}
                                </span>
                            )}
                        </p>
                        <p className="shrink-0 text-xs font-semibold tabular-nums text-stone-500">
                            {rad.antall}/{totaltSvar} · {pst}%
                        </p>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                        <div
                            className={cn(
                                'h-full rounded-full',
                                rad.erMitt ? 'bg-linear-to-r from-amber-400 to-amber-600' : 'bg-stone-400',
                            )}
                            style={{ width: `${pst}%` }}
                        />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        <div className="flex">
                            {synlige.map((navn, i) => (
                                <span key={navn + i} className="relative first:ml-0 -ml-2">
                                    <span
                                        className="flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br from-stone-600 to-stone-800 text-[9px] font-semibold text-white ring-2 ring-white"
                                        title={navn}
                                    >
                                        {initialer(navn)}
                                    </span>
                                    {rad.byttere.includes(navn) && (
                                        <span
                                            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white ring-2 ring-white"
                                            title={t.allesTips.byttetMerkeKort}
                                        >
                                            <Repeat className="h-2 w-2" />
                                        </span>
                                    )}
                                </span>
                            ))}
                            {resterende > 0 && (
                                <span className="-ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-[9px] font-semibold text-stone-600 ring-2 ring-white">
                                    +{resterende}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <ChevronRight
                    className={cn('h-4 w-4 shrink-0 text-stone-400 transition-transform', apen && 'rotate-90')}
                />
            </button>

            {apen && (
                <div className="flex flex-wrap gap-1.5 border-t border-stone-100 px-3 py-3">
                    {rad.deltakere.map((navn, i) => (
                        <span
                            key={navn + i}
                            className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700"
                        >
                            {navn}
                        </span>
                    ))}
                </div>
            )}
        </li>
    )
}

function Emblem({ flagg, navn, stor }: { flagg: string; navn: string; stor?: boolean }) {
    const dim = stor ? 'h-11 w-11 text-lg' : 'h-9 w-9 text-xs'
    if (flagg) {
        return (
            <span
                className={cn('flex shrink-0 items-center justify-center leading-none', stor ? 'text-3xl' : 'text-2xl')}
            >
                {flagg}
            </span>
        )
    }
    return (
        <span
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-stone-600 to-stone-800 font-semibold text-white',
                dim,
            )}
        >
            {initialer(navn)}
        </span>
    )
}

function TomTilstand({ tekst }: { tekst: string }) {
    return (
        <div className="rounded-2xl bg-white px-4 py-10 text-center shadow-xs ring-1 ring-stone-200/70">
            <p className="text-sm text-stone-500">{tekst}</p>
        </div>
    )
}
