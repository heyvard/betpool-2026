import React, { useState } from 'react'
import NextLink from 'next/link'
import { ArrowRight, Plus, Send, SmilePlus, Trash2, X } from 'lucide-react'

import { FeedKommentar, FeedPost, FeedReaksjon } from '../../queries/useFeed'
import { UseMutateFeedReaksjon } from '../../queries/mutateFeedReaksjon'
import { UseMutateFeedKommentar } from '../../queries/mutateFeedKommentar'
import { UseMutateFeedKommentarReaksjon } from '../../queries/mutateFeedKommentarReaksjon'
import { UseMutateFeedSlettPost } from '../../queries/mutateFeedSlettPost'
import { EMOJI_KATEGORIER, STANDARD_EMOJI } from '../../utils/feedEmoji'
import { useLanguage } from '../../i18n/LanguageContext'
import { hentFlag, hentNavn } from '../../utils/lag'
import { ACCENT, relativKort, tidEtikett, visningsnavn } from './feedUtils'
import {
    BytteAvsenderIkon,
    FeedAvatar,
    Flagg,
    KampAvsenderIkon,
    MorgenrapportIkon,
    PodiumAvsenderIkon,
} from './FeedBits'

interface Props {
    post: FeedPost
    meNavn: string
    mePicture: string | null
    erSuperadmin?: boolean
}

// Full emoji-popup: alle tillatte emoji gruppert i kategorier, i en scrollbar
// rute. Åpnes fra hurtigvelgeren via «flere»-knappen.
function EmojiPopup({ onVelg, onLukk }: { onVelg: (emoji: string) => void; onLukk: () => void }) {
    return (
        <div
            className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-stone-200"
            style={{ width: 272 }}
            role="menu"
        >
            <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
                <span className="bp-overline" style={{ color: '#78716c' }}>
                    Velg reaksjon
                </span>
                <button
                    type="button"
                    onClick={onLukk}
                    className="flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                    style={{ width: 24, height: 24 }}
                    aria-label="Lukk"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="overflow-y-auto p-2" style={{ maxHeight: 260 }}>
                {EMOJI_KATEGORIER.map((kat) => (
                    <div key={kat.navn} className="mb-1.5 last:mb-0">
                        <div className="bp-overline px-1 pb-1" style={{ color: '#a8a29e' }}>
                            {kat.navn}
                        </div>
                        <div className="grid grid-cols-7 gap-0.5">
                            {kat.emoji.map((e) => (
                                <button
                                    key={e}
                                    type="button"
                                    onClick={() => onVelg(e)}
                                    className="flex items-center justify-center rounded-lg text-[20px] hover:bg-stone-100"
                                    style={{ width: 34, height: 34 }}
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Hurtigvelger: en rad med standard-emoji + en «flere»-knapp som åpner hele
// EmojiPopup-en med alle tilgjengelige emoji.
function EmojiVelger({ onVelg }: { onVelg: (emoji: string) => void }) {
    const [visAlle, setVisAlle] = useState(false)

    if (visAlle) {
        return <EmojiPopup onVelg={onVelg} onLukk={() => setVisAlle(false)} />
    }

    return (
        <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-md ring-1 ring-stone-200" role="menu">
            {STANDARD_EMOJI.map((e) => (
                <button
                    key={e}
                    type="button"
                    onClick={() => onVelg(e)}
                    className="flex items-center justify-center rounded-full text-[18px] hover:bg-stone-100"
                    style={{ width: 32, height: 32 }}
                >
                    {e}
                </button>
            ))}
            <button
                type="button"
                onClick={() => setVisAlle(true)}
                className="flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
                style={{ width: 32, height: 32 }}
                aria-label="Flere emoji"
            >
                <SmilePlus size={17} />
            </button>
        </div>
    )
}

function ReaksjonsPille({ r, liten, onClick }: { r: FeedReaksjon; liten?: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="bp-tabular inline-flex items-center gap-1 rounded-full font-bold transition-colors"
            style={{
                padding: liten ? '2px 7px' : '4px 9px',
                fontSize: liten ? 11 : 12,
                minHeight: liten ? undefined : 28,
                background: r.mine ? '#dbeafe' : '#f5f5f4',
                color: r.mine ? '#1e40af' : '#44403c',
                boxShadow: r.mine ? 'inset 0 0 0 1px #bfdbfe' : undefined,
            }}
        >
            <span>{r.emoji}</span>
            <span>{r.antall}</span>
        </button>
    )
}

// Lag-celle i score-blokken: flagg + tre-bokstavskode.
function LagCelle({ tla }: { tla: string }) {
    return (
        <div className="flex flex-col items-center gap-1.5">
            {hentFlag(tla) ? (
                <span style={{ fontSize: 22, lineHeight: '20px' }}>{hentFlag(tla)}</span>
            ) : (
                <Flagg tla={tla} />
            )}
            <span className="text-[12px] font-extrabold" style={{ color: '#44403c' }}>
                {tla}
            </span>
        </div>
    )
}

// Score-blokk (kun kamp-poster). Lenker til kampsiden når match_num finnes.
function ScoreBlokk({ data, matchNum }: { data: Record<string, unknown>; matchNum: number | null }) {
    const homeTeam = String(data.homeTeam ?? '')
    const awayTeam = String(data.awayTeam ?? '')
    const resultat = String(data.resultat ?? '')
    const rundeTekst = String(data.rundeTekst ?? '')
    const innhold = (
        <>
            <div className="flex items-center justify-center gap-5">
                <LagCelle tla={homeTeam} />
                <span className="bp-tabular font-bold" style={{ fontSize: 28 }}>
                    {resultat}
                </span>
                <LagCelle tla={awayTeam} />
            </div>
            <div
                className="mt-2.5 text-center uppercase"
                style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: '#a8a29e' }}
            >
                {rundeTekst}
            </div>
        </>
    )
    const stil: React.CSSProperties = {
        display: 'block',
        margin: '13px 0',
        padding: 14,
        borderRadius: 12,
        boxShadow: 'inset 0 0 0 1px #e7e5e4',
    }
    if (matchNum != null) {
        return (
            <NextLink
                href={`/match/${matchNum}`}
                style={stil}
                className="bg-stone-50 transition-colors hover:bg-stone-100"
            >
                {innhold}
            </NextLink>
        )
    }
    return (
        <div style={stil} className="bg-stone-50">
            {innhold}
        </div>
    )
}

// Bytte-blokk (kind='bytte'): fra-verdi → til-verdi, sentrert. Flagg for vinner,
// et enkelt ⚽️-symbol for toppscorer (spillere har ikke flagg i UI-et).
function SwapBlokk({ data }: { data: Record<string, unknown> }) {
    const fraFlagg = String(data.fraFlagg ?? '')
    const fraLabel = String(data.fraLabel ?? '')
    const tilFlagg = String(data.tilFlagg ?? '')
    const tilLabel = String(data.tilLabel ?? '')
    return (
        <div
            className="flex items-center justify-center gap-3"
            style={{ margin: '13px 0', padding: 14, borderRadius: 12, boxShadow: 'inset 0 0 0 1px #e7e5e4' }}
        >
            <div className="flex min-w-0 items-center gap-1.5">
                <span style={{ fontSize: 20, lineHeight: 1 }}>{fraFlagg}</span>
                <span className="truncate font-semibold" style={{ fontSize: 13, color: '#a8a29e' }}>
                    {fraLabel}
                </span>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-amber-500" />
            <div className="flex min-w-0 items-center gap-1.5">
                <span style={{ fontSize: 20, lineHeight: 1 }}>{tilFlagg}</span>
                <span className="truncate font-bold" style={{ fontSize: 13, color: '#1c1917' }}>
                    {tilLabel}
                </span>
            </div>
        </div>
    )
}

// Mini-topp-3 (lederbytte / leder_holder / delt_ledelse).
function MiniTopp3({ data }: { data: Record<string, unknown> }) {
    const topp3 = (data.topp3 as { plass: number; navn: string; poeng: number; leder: boolean }[]) ?? []
    return (
        <div style={{ marginTop: 12, borderRadius: 12, boxShadow: 'inset 0 0 0 1px #e7e5e4', overflow: 'hidden' }}>
            {topp3.map((r) => (
                <div
                    key={r.plass}
                    className="flex items-center gap-3"
                    style={{
                        padding: '9px 12px',
                        fontSize: 13,
                        background: r.leder ? 'linear-gradient(90deg,#fffbeb,#fff)' : undefined,
                        borderTop: r.plass > 1 ? '1px solid #f5f5f4' : undefined,
                    }}
                >
                    <span className="bp-tabular" style={{ color: r.leder ? '#b45309' : '#a8a29e', fontWeight: 700 }}>
                        {r.plass}
                    </span>
                    <span className="flex-1 font-bold" style={{ color: '#1c1917' }}>
                        {visningsnavn(r.navn)}
                        {r.leder && <span className="ml-1">👑</span>}
                    </span>
                    <span className="bp-tabular" style={{ color: '#44403c' }}>
                        {r.poeng}
                    </span>
                </div>
            ))}
        </div>
    )
}

// Delta-liste (endring).
function DeltaListe({ data }: { data: Record<string, unknown> }) {
    const delta = (data.delta as { navn: string; deltaPlass: number; nyPlass: number }[]) ?? []
    if (delta.length === 0) return null
    return (
        <div style={{ marginTop: 8 }}>
            {delta.map((d, i) => {
                const opp = d.deltaPlass > 0
                return (
                    <div
                        key={i}
                        className="flex items-center gap-2.5"
                        style={{ padding: '7px 0', borderTop: '1px solid #f5f5f4' }}
                    >
                        <span
                            className="bp-tabular"
                            style={{
                                fontWeight: 800,
                                fontSize: 12,
                                width: 42,
                                color: opp ? '#16a34a' : '#dc2626',
                            }}
                        >
                            {opp ? '▲' : '▼'} {opp ? '+' : '−'}
                            {Math.abs(d.deltaPlass)}
                        </span>
                        <span className="flex-1 font-semibold" style={{ color: '#1c1917' }}>
                            {visningsnavn(d.navn)}
                        </span>
                        <span className="bp-tabular" style={{ color: '#78716c' }}>
                            → {d.nyPlass}.
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

// Bunn-stripe (endring): hvem ligger sist (jumbo). Liten, nedtonet linje under
// delta-lista — vi snakker også om dem som ligger helt nederst.
function BunnStripe({ data }: { data: Record<string, unknown> }) {
    const bunn = data.bunn as { jumbo: { navn: string; plass: number; poeng: number }; nyJumbo: boolean } | null
    if (!bunn?.jumbo) return null
    return (
        <div
            className="mt-2 flex items-center gap-2.5"
            style={{
                padding: '8px 11px',
                borderRadius: 12,
                background: '#fafaf9',
                boxShadow: 'inset 0 0 0 1px #f5f5f4',
            }}
        >
            <span style={{ fontSize: 14 }}>{bunn.nyJumbo ? '🪦' : '⚓'}</span>
            <span className="bp-overline" style={{ color: '#a8a29e' }}>
                Jumbo
            </span>
            <span className="flex-1 truncate font-bold" style={{ fontSize: 13, color: '#57534e' }}>
                {visningsnavn(bunn.jumbo.navn)}
            </span>
            <span className="bp-tabular" style={{ fontSize: 12, fontWeight: 700, color: '#a8a29e' }}>
                {bunn.jumbo.plass}. · {bunn.jumbo.poeng}
            </span>
        </div>
    )
}

// Fangst-stripe (alle morgenrapporter): nattens poengkonge — hvem sanket flest
// poeng siden forrige rapport. Hovedvinkelen, så den vises øverst blant stripene.
// Returnerer null når ingen sanket poeng (alle bommet) eller ingen baseline ennå.
function FangstStripe({ data }: { data: Record<string, unknown> }) {
    const f = data.fangst as
        | { topp: { navn: string; deltaPoeng: number; plass: number }; delere: string[] }
        | null
        | undefined
    if (!f?.topp) return null
    const delt = (f.delere?.length ?? 0) > 0
    const navn = delt ? `${visningsnavn(f.topp.navn)} +${f.delere.length}` : visningsnavn(f.topp.navn)
    return (
        <div
            className="mt-2 flex items-center gap-2.5"
            style={{
                padding: '8px 11px',
                borderRadius: 12,
                background: 'linear-gradient(90deg,#fffbeb,#fafaf9)',
                boxShadow: 'inset 0 0 0 1px #fde68a',
            }}
        >
            <span style={{ fontSize: 14 }}>🔥</span>
            <span className="bp-overline" style={{ color: '#b45309' }}>
                Nattens poengkonge
            </span>
            <span className="flex-1 truncate font-bold" style={{ fontSize: 13, color: '#1c1917' }}>
                {navn}
            </span>
            <span className="bp-tabular" style={{ fontSize: 12, fontWeight: 800, color: '#16a34a' }}>
                +{f.topp.deltaPoeng}
            </span>
        </div>
    )
}

// Joker-stripe (alle morgenrapporter): hvor mange jokere ble lagt på nattens
// kamper, og hvor mange brant vs. satt. Vises bare når noen faktisk satset joker.
function JokerStripe({ data }: { data: Record<string, unknown> }) {
    const j = data.jokerStatistikk as { satt: number; brent: number; totalt: number } | undefined
    if (!j || j.totalt === 0) return null
    const status =
        j.brent > 0 && j.satt > 0
            ? `${j.brent} brent · ${j.satt} satt`
            : j.brent > 0
              ? `${j.totalt} brent`
              : `${j.totalt} satt`
    return (
        <div
            className="mt-2 flex items-center gap-2.5"
            style={{
                padding: '8px 11px',
                borderRadius: 12,
                background: '#fafaf9',
                boxShadow: 'inset 0 0 0 1px #f5f5f4',
            }}
        >
            <span style={{ fontSize: 14 }}>🃏</span>
            <span className="bp-overline" style={{ color: '#a8a29e' }}>
                Joker
            </span>
            <span className="flex-1 truncate font-bold" style={{ fontSize: 13, color: '#57534e' }}>
                {status}
            </span>
            <span className="bp-tabular" style={{ fontSize: 12, fontWeight: 700, color: '#a8a29e' }}>
                {j.totalt} {j.totalt === 1 ? 'joker' : 'jokere'}
            </span>
        </div>
    )
}

// AI-morgenrapportens seksjoner (scenario === 'ai'): Claude-skrevne deler med emoji,
// overskrift og brødtekst. Hver seksjon vises som et nedtonet kort. Erstatter
// fangst-/joker-/bunn-stripene for AI-rapporter (de har ikke de data-feltene).
function AiSeksjoner({ data }: { data: Record<string, unknown> }) {
    const seksjoner = (data.seksjoner as { emoji: string; overskrift: string; tekst: string }[] | undefined) ?? []
    if (seksjoner.length === 0) return null
    return (
        <div className="flex flex-col gap-2" style={{ marginTop: 12 }}>
            {seksjoner.map((s, i) => (
                <div
                    key={i}
                    style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: '#fafaf9',
                        boxShadow: 'inset 0 0 0 1px #f5f5f4',
                    }}
                >
                    <div className="flex items-center gap-2">
                        <span style={{ fontSize: 15 }}>{s.emoji}</span>
                        <span className="bp-overline" style={{ color: '#57534e' }}>
                            {s.overskrift}
                        </span>
                    </div>
                    <p
                        style={{
                            fontSize: 13.5,
                            color: '#44403c',
                            lineHeight: 1.5,
                            marginTop: 5,
                            whiteSpace: 'pre-line',
                        }}
                    >
                        {s.tekst}
                    </p>
                </div>
            ))}
        </div>
    )
}

// Pallen-blokken (kind='podium'): en klassisk podium-oppstilling (sølv—gull—bronse)
// med avatar/navn/poeng per plassering, etterfulgt av Claudes reise-oppsummering
// for hver av de tre, i medalje-fargede kort.
const PODIUM_FARGE: Record<number, string> = { 1: '#f59e0b', 2: '#a8a29e', 3: '#b45309' }
const PODIUM_HØYDE: Record<number, number> = { 1: 80, 2: 58, 3: 46 }
const PODIUM_REKKEFØLGE = [2, 1, 3]

function PodiumBlokk({ data }: { data: Record<string, unknown> }) {
    const topp3 =
        (data.topp3 as { plass: number; userId: string; navn: string; picture: string | null; poeng: number }[]) ?? []
    const spillere = (data.spillere as { userId: string; emoji: string; tekst: string }[]) ?? []
    const vinner = data.vinner as { tla: string; navn: string; flagg: string } | null
    const toppscorere = (data.toppscorere as string[]) ?? []

    return (
        <div style={{ marginTop: 12 }}>
            {(vinner || toppscorere.length > 0) && (
                <div
                    className="flex flex-wrap items-center gap-x-3 gap-y-1"
                    style={{ marginBottom: 12, fontSize: 12.5, color: '#57534e' }}
                >
                    {vinner && (
                        <span>
                            <span className="font-bold">Vinner:</span> {vinner.flagg} {vinner.navn}
                        </span>
                    )}
                    {toppscorere.length > 0 && (
                        <span>
                            <span className="font-bold">Toppscorer:</span> {toppscorere.join(', ')}
                        </span>
                    )}
                </div>
            )}

            <div className="flex items-end justify-center gap-2">
                {PODIUM_REKKEFØLGE.map((plass) => {
                    const s = topp3.find((t) => t.plass === plass)
                    if (!s) return null
                    return (
                        <div key={plass} className="flex flex-col items-center" style={{ width: 88 }}>
                            <FeedAvatar src={s.picture} navn={s.navn} size={plass === 1 ? 46 : 38} />
                            <span
                                className="mt-1 truncate text-center font-bold"
                                style={{ fontSize: 12.5, color: '#1c1917', maxWidth: 86 }}
                            >
                                {visningsnavn(s.navn)}
                            </span>
                            <span className="bp-tabular" style={{ fontSize: 11, color: '#78716c' }}>
                                {s.poeng} p
                            </span>
                            <div
                                className="mt-1.5 flex w-full items-center justify-center font-black text-white"
                                style={{
                                    height: PODIUM_HØYDE[plass],
                                    background: PODIUM_FARGE[plass],
                                    borderRadius: '8px 8px 0 0',
                                    fontSize: 18,
                                }}
                            >
                                {plass}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="flex flex-col gap-2" style={{ marginTop: 14 }}>
                {[1, 2, 3].map((plass) => {
                    const s = topp3.find((t) => t.plass === plass)
                    const tekst = spillere.find((sp) => sp.userId === s?.userId)
                    if (!s || !tekst) return null
                    return (
                        <div
                            key={plass}
                            style={{
                                padding: '10px 12px',
                                borderRadius: 12,
                                background: '#fafaf9',
                                boxShadow: `inset 0 0 0 1px ${PODIUM_FARGE[plass]}55`,
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <span style={{ fontSize: 15 }}>{tekst.emoji}</span>
                                <span className="bp-overline" style={{ color: '#57534e' }}>
                                    {plass}. plass · {visningsnavn(s.navn)}
                                </span>
                            </div>
                            <p
                                style={{
                                    fontSize: 13.5,
                                    color: '#44403c',
                                    lineHeight: 1.5,
                                    marginTop: 5,
                                    whiteSpace: 'pre-line',
                                }}
                            >
                                {tekst.tekst}
                            </p>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function KommentarRad({
    post,
    kommentar,
    onVelgerToggle,
}: {
    post: FeedPost
    kommentar: FeedKommentar
    onVelgerToggle: (åpen: boolean) => void
}) {
    const [pickerOpen, setPickerOpen] = useState(false)
    const reaksjon = UseMutateFeedKommentarReaksjon()
    const settÅpen = (åpen: boolean) => {
        setPickerOpen(åpen)
        onVelgerToggle(åpen)
    }
    return (
        <div className="flex gap-2.5">
            <FeedAvatar src={kommentar.picture} navn={kommentar.navn} size={30} />
            <div className="min-w-0 flex-1">
                <div>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1c1917' }}>
                        {visningsnavn(kommentar.navn)}
                    </span>
                    <span style={{ fontSize: 11, color: '#a8a29e', marginLeft: 6 }}>
                        {relativKort(kommentar.created_at)}
                    </span>
                </div>
                <div style={{ fontSize: 13, color: '#44403c', lineHeight: 1.4 }}>{kommentar.body}</div>
                <div className="relative mt-1 flex flex-wrap items-center gap-1.5">
                    {kommentar.reactions.map((r) => (
                        <ReaksjonsPille
                            key={r.emoji}
                            r={r}
                            liten
                            onClick={() =>
                                reaksjon.mutate({ postId: post.id, commentId: kommentar.id, emoji: r.emoji })
                            }
                        />
                    ))}
                    <button
                        type="button"
                        onClick={() => settÅpen(!pickerOpen)}
                        className="flex items-center justify-center rounded-full text-stone-500"
                        style={{ width: 22, height: 20, background: '#f5f5f4' }}
                        aria-label="Legg til reaksjon"
                    >
                        <Plus size={12} />
                    </button>
                    {pickerOpen && (
                        <div className="absolute top-full left-0 z-20 mt-1">
                            <EmojiVelger
                                onVelg={(emoji) => {
                                    settÅpen(false)
                                    reaksjon.mutate({ postId: post.id, commentId: kommentar.id, emoji })
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export function FeedKort({ post, meNavn, mePicture, erSuperadmin }: Props) {
    const { t, locale } = useLanguage()
    const farger = ACCENT[post.accent] ?? ACCENT.stone
    const [pickerOpen, setPickerOpen] = useState(false)
    const [åpneKommentarVelgere, setÅpneKommentarVelgere] = useState(0)
    const [tekst, setTekst] = useState('')
    const reaksjon = UseMutateFeedReaksjon()
    const kommentar = UseMutateFeedKommentar()
    const slettPost = UseMutateFeedSlettPost()

    // Når en emoji-velger er åpen må kortet løftes over kortene under, ellers
    // havner popup-en bak dem (senere søsken-kort males oppå).
    const velgerÅpen = pickerOpen || åpneKommentarVelgere > 0

    const sendKommentar = () => {
        const ren = tekst.trim()
        if (!ren) return
        kommentar.mutate({ postId: post.id, body: ren, meNavn, mePicture })
        setTekst('')
    }

    const håndterSlett = () => {
        if (window.confirm(t.feed.slettBekreft)) {
            slettPost.mutate({ postId: post.id })
        }
    }

    return (
        <article
            style={{
                position: 'relative',
                zIndex: velgerÅpen ? 30 : undefined,
                background: '#fff',
                borderRadius: 18,
                margin: '0 12px 12px',
                boxShadow: '0 1px 3px rgba(0,0,0,.05), 0 0 0 1px #e7e5e4',
            }}
        >
            <div style={{ height: 4, background: farger.acc, borderTopLeftRadius: 18, borderTopRightRadius: 18 }} />
            <div style={{ padding: '14px 15px 16px' }}>
                {/* Avsender-rad */}
                <div className="flex items-center gap-2.5">
                    {post.kind === 'kamp' ? (
                        <KampAvsenderIkon
                            home={String(post.data.homeTeam ?? '')}
                            away={String(post.data.awayTeam ?? '')}
                            size={34}
                        />
                    ) : post.kind === 'bytte' ? (
                        <BytteAvsenderIkon size={34} />
                    ) : post.kind === 'podium' ? (
                        <PodiumAvsenderIkon size={34} />
                    ) : (
                        <MorgenrapportIkon size={34} farger={farger} />
                    )}
                    <div className="min-w-0">
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1c1917' }}>
                            {post.kind === 'kamp'
                                ? `${hentNavn(String(post.data.homeTeam ?? ''), locale)}–${hentNavn(
                                      String(post.data.awayTeam ?? ''),
                                      locale,
                                  )}`
                                : post.kind === 'bytte'
                                  ? t.feed.avsenderBytte
                                  : post.kind === 'podium'
                                    ? t.feed.avsenderPodium
                                    : t.feed.avsenderMorgenrapport}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: farger.acctx }}>
                            {post.kind === 'kamp' && post.data.rundeTekst ? `${String(post.data.rundeTekst)} · ` : ''}
                            {tidEtikett(post.created_at)}
                        </div>
                    </div>
                    {erSuperadmin && (
                        <button
                            type="button"
                            onClick={håndterSlett}
                            disabled={slettPost.isPending}
                            className="ml-auto flex shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-red-600 disabled:opacity-40"
                            style={{ width: 30, height: 30 }}
                            aria-label={t.feed.slettPost}
                            title={t.feed.slettPost}
                        >
                            <Trash2 size={15} />
                        </button>
                    )}
                </div>

                {/* Tittel + body */}
                <h3
                    style={{
                        fontSize: 17,
                        fontWeight: 800,
                        letterSpacing: '-.01em',
                        lineHeight: 1.2,
                        marginTop: 12,
                        color: '#1c1917',
                    }}
                >
                    {post.tittel}
                </h3>
                <p style={{ fontSize: 13.5, color: '#57534e', lineHeight: 1.5, marginTop: 6, whiteSpace: 'pre-line' }}>
                    {post.body}
                </p>

                {/* Strukturert tillegg */}
                {post.kind === 'kamp' && <ScoreBlokk data={post.data} matchNum={post.match_num} />}
                {post.kind === 'bytte' && <SwapBlokk data={post.data} />}
                {post.kind === 'podium' && (
                    <>
                        <PodiumBlokk data={post.data} />
                        <div
                            className="mt-2 flex items-center gap-1"
                            style={{ fontSize: 11, color: '#a8a29e', fontWeight: 600 }}
                        >
                            <span>🤖</span>
                            <span>AI-generert</span>
                        </div>
                    </>
                )}
                {(post.scenario === 'lederbytte' ||
                    post.scenario === 'leder_holder' ||
                    post.scenario === 'delt_ledelse') && <MiniTopp3 data={post.data} />}
                {post.scenario === 'endring' && <DeltaListe data={post.data} />}
                {/* Nattens poengkonge er hovedvinkelen og vises øverst. Joker-status
                    henger på alle morgenrapporter; bunnstriden vises kun ved reell
                    dramatikk (ny jumbo) — ikke samme stakkar hver morgen. */}
                {post.kind === 'morgenrapport' && (
                    <>
                        {/* AI-rapporter (scenario 'ai') rendres som seksjoner; de malbaserte
                            som stripene under (som returnerer null for AI-data). */}
                        <AiSeksjoner data={post.data} />
                        <FangstStripe data={post.data} />
                        <JokerStripe data={post.data} />
                        {(post.data.bunn as { nyJumbo?: boolean } | null)?.nyJumbo && <BunnStripe data={post.data} />}
                        {/* AI-rapporter får en liten signatur som markerer at teksten er maskingenerert. */}
                        {post.scenario === 'ai' && (
                            <div
                                className="mt-2 flex items-center gap-1"
                                style={{ fontSize: 11, color: '#a8a29e', fontWeight: 600 }}
                            >
                                <span>🤖</span>
                                <span>AI-generert</span>
                            </div>
                        )}
                    </>
                )}

                {/* Reaksjons-rad */}
                <div className="relative mt-3.5 flex flex-wrap items-center gap-1.5">
                    {post.reactions.map((r) => (
                        <ReaksjonsPille
                            key={r.emoji}
                            r={r}
                            onClick={() => reaksjon.mutate({ postId: post.id, emoji: r.emoji })}
                        />
                    ))}
                    <button
                        type="button"
                        onClick={() => setPickerOpen((v) => !v)}
                        className="flex items-center justify-center rounded-full text-stone-500"
                        style={{ width: 28, height: 24, background: '#f5f5f4' }}
                        aria-label="Legg til reaksjon"
                    >
                        <Plus size={14} />
                    </button>
                    {pickerOpen && (
                        <div className="absolute top-full left-0 z-20 mt-1">
                            <EmojiVelger
                                onVelg={(emoji) => {
                                    setPickerOpen(false)
                                    reaksjon.mutate({ postId: post.id, emoji })
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Kommentarer */}
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f5f5f4' }}>
                    <div className="flex flex-col gap-3">
                        {post.kommentarer.map((k) => (
                            <KommentarRad
                                key={k.id}
                                post={post}
                                kommentar={k}
                                onVelgerToggle={(åpen) =>
                                    setÅpneKommentarVelgere((n) => Math.max(0, n + (åpen ? 1 : -1)))
                                }
                            />
                        ))}
                    </div>

                    {/* Skrivefelt */}
                    <div className="mt-3.5 flex items-center gap-2.5">
                        <FeedAvatar src={mePicture} navn={meNavn} size={30} />
                        <input
                            value={tekst}
                            onChange={(e) => setTekst(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    sendKommentar()
                                }
                            }}
                            placeholder={t.feed.skrivKommentar}
                            maxLength={500}
                            className="flex-1 outline-none"
                            style={{
                                background: '#f5f5f4',
                                borderRadius: 999,
                                padding: '9px 14px',
                                fontSize: 12.5,
                                minHeight: 38,
                            }}
                        />
                        <button
                            type="button"
                            onClick={sendKommentar}
                            disabled={!tekst.trim()}
                            className="flex shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
                            style={{ width: 32, height: 32, background: '#1c1917' }}
                            aria-label="Send kommentar"
                        >
                            <Send size={15} />
                        </button>
                    </div>
                </div>
            </div>
        </article>
    )
}
