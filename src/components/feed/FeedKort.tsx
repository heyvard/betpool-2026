import React, { useState } from 'react'
import { Plus, Send } from 'lucide-react'

import { FeedKommentar, FeedPost, FeedReaksjon } from '../../queries/useFeed'
import { UseMutateFeedReaksjon } from '../../queries/mutateFeedReaksjon'
import { UseMutateFeedKommentar } from '../../queries/mutateFeedKommentar'
import { UseMutateFeedKommentarReaksjon } from '../../queries/mutateFeedKommentarReaksjon'
import { TILLATTE_EMOJI } from '../../utils/feedEmoji'
import { useLanguage } from '../../i18n/LanguageContext'
import { hentFlag, hentNavn } from '../../utils/lag'
import { ACCENT, relativKort, tidEtikett, visningsnavn } from './feedUtils'
import { FeedAvatar, Flagg, KampAvsenderIkon, MorgenrapportIkon } from './FeedBits'

interface Props {
    post: FeedPost
    meNavn: string
    mePicture: string | null
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

// Score-blokk (kun kamp-poster).
function ScoreBlokk({ data }: { data: Record<string, unknown> }) {
    const homeTeam = String(data.homeTeam ?? '')
    const awayTeam = String(data.awayTeam ?? '')
    const resultat = String(data.resultat ?? '')
    const rundeTekst = String(data.rundeTekst ?? '')
    return (
        <div
            style={{
                margin: '13px 0',
                padding: 14,
                borderRadius: 12,
                background: '#fafaf9',
                boxShadow: 'inset 0 0 0 1px #e7e5e4',
            }}
        >
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
        </div>
    )
}

// Mini-topp-3 (lederbytte).
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

export function FeedKort({ post, meNavn, mePicture }: Props) {
    const { t, locale } = useLanguage()
    const farger = ACCENT[post.accent] ?? ACCENT.stone
    const [pickerOpen, setPickerOpen] = useState(false)
    const [tekst, setTekst] = useState('')
    const reaksjon = UseMutateFeedReaksjon()
    const kommentar = UseMutateFeedKommentar()

    const sendKommentar = () => {
        const ren = tekst.trim()
        if (!ren) return
        kommentar.mutate({ postId: post.id, body: ren, meNavn, mePicture })
        setTekst('')
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
                <p style={{ fontSize: 13.5, color: '#57534e', lineHeight: 1.5, marginTop: 6 }}>{post.body}</p>

                {/* Strukturert tillegg */}
                {post.kind === 'kamp' && <ScoreBlokk data={post.data} />}
                {post.scenario === 'lederbytte' && <MiniTopp3 data={post.data} />}
                {post.scenario === 'endring' && <DeltaListe data={post.data} />}

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
