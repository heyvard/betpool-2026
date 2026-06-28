import React, { useState } from 'react'
import NextLink from 'next/link'
import { Plus, Send, Trash2 } from 'lucide-react'

import { FeedKommentar, FeedPost, FeedReaksjon } from '../../queries/useFeed'
import { UseMutateFeedReaksjon } from '../../queries/mutateFeedReaksjon'
import { UseMutateFeedKommentar } from '../../queries/mutateFeedKommentar'
import { UseMutateFeedKommentarReaksjon } from '../../queries/mutateFeedKommentarReaksjon'
import { UseMutateFeedSlettPost } from '../../queries/mutateFeedSlettPost'
import { TILLATTE_EMOJI } from '../../utils/feedEmoji'
import { useLanguage } from '../../i18n/LanguageContext'
import { hentFlag, hentNavn } from '../../utils/lag'
import { ACCENT, relativKort, tidEtikett, visningsnavn } from './feedUtils'
import { FeedAvatar, Flagg, KampAvsenderIkon, MorgenrapportIkon } from './FeedBits'

interface Props {
    post: FeedPost
    meNavn: string
    mePicture: string | null
    erSuperadmin?: boolean
}

function EmojiVelger({ onVelg }: { onVelg: (emoji: string) => void }) {
    return (
        <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-md ring-1 ring-stone-200" role="menu">
            {TILLATTE_EMOJI.map((e) => (
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

function KommentarRad({ post, kommentar }: { post: FeedPost; kommentar: FeedKommentar }) {
    const [pickerOpen, setPickerOpen] = useState(false)
    const reaksjon = UseMutateFeedKommentarReaksjon()
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
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setPickerOpen((v) => !v)}
                            className="flex items-center justify-center rounded-full text-stone-500"
                            style={{ width: 22, height: 20, background: '#f5f5f4' }}
                            aria-label="Legg til reaksjon"
                        >
                            <Plus size={12} />
                        </button>
                        {pickerOpen && (
                            <div className="absolute left-0 z-10 mt-1">
                                <EmojiVelger
                                    onVelg={(emoji) => {
                                        setPickerOpen(false)
                                        reaksjon.mutate({ postId: post.id, commentId: kommentar.id, emoji })
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export function FeedKort({ post, meNavn, mePicture, erSuperadmin }: Props) {
    const { t, locale } = useLanguage()
    const farger = ACCENT[post.accent] ?? ACCENT.stone
    const [pickerOpen, setPickerOpen] = useState(false)
    const [tekst, setTekst] = useState('')
    const reaksjon = UseMutateFeedReaksjon()
    const kommentar = UseMutateFeedKommentar()
    const slettPost = UseMutateFeedSlettPost()

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
                background: '#fff',
                borderRadius: 18,
                margin: '0 12px 12px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,.05), 0 0 0 1px #e7e5e4',
            }}
        >
            <div style={{ height: 4, background: farger.acc }} />
            <div style={{ padding: '14px 15px 16px' }}>
                {/* Avsender-rad */}
                <div className="flex items-center gap-2.5">
                    {post.kind === 'kamp' ? (
                        <KampAvsenderIkon
                            home={String(post.data.homeTeam ?? '')}
                            away={String(post.data.awayTeam ?? '')}
                            size={34}
                        />
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
                        <div className="absolute bottom-8 left-0 z-10">
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
                            <KommentarRad key={k.id} post={post} kommentar={k} />
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
