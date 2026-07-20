import type { NextPage } from 'next'
import { Spinner } from '../../components/loading/Spinner'
import { useRouter } from 'next/router'
import NextLink from 'next/link'
import { UseAllBets, MatchBetMedScore, OtherUser, SluttspillResultat } from '../../queries/useAllBets'
import { calculateAllBetsExtended, filtrerAllBets } from '../../components/results/calculateAllBetsExtended'
import React, { useMemo, useState } from 'react'
import { hentFlag, hentNavn } from '../../utils/lag'
import { UseUser } from '../../queries/useUser'
import { useLanguage } from '../../i18n/LanguageContext'
import { tx } from '../../i18n/interpolate'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import { cn } from '@/lib/utils'
import { CheckCheck, Flag, Target, Trophy, X, Zap } from 'lucide-react'
import { finnUtfall, Utfall } from '../../components/results/matchScoreCalculator'
import { fixLand } from '../../components/bet/BetView'
import { erNorgeKamp } from '../../data/matches'
import type { Translations } from '../../i18n/no'

type BetWithUser = MatchBetMedScore & { user: OtherUser }
type SortOrder = 'poeng' | 'navn' | 'skor'

const AVATAR_COLORS = [
    'bg-blue-200 text-blue-800',
    'bg-violet-200 text-violet-800',
    'bg-teal-200 text-teal-800',
    'bg-rose-200 text-rose-800',
    'bg-sky-200 text-sky-800',
    'bg-cyan-200 text-cyan-800',
    'bg-orange-200 text-orange-800',
    'bg-fuchsia-200 text-fuchsia-800',
]

function avatarColor(name: string): string {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initials(name: string): string {
    return name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
}

// ---------- MatchHero-hjelpere ----------

// Lagkolonne i hero-en. Markerer vinneren (fet hvit + gull «Videre»-pille med
// trofé) og demper taperen lett. `vant`/`tapte` er begge false for vanlige
// kamper — da ser kolonnen ut som før.
function TeamColumn({
    team,
    locale,
    vant,
    tapte,
    t,
}: {
    team: string
    locale: 'no' | 'fr'
    vant: boolean
    tapte: boolean
    t: Translations
}) {
    return (
        <div className="flex flex-col items-center gap-1.5">
            <span className={cn('text-[38px] leading-none', tapte && 'opacity-90')}>{hentFlag(team)}</span>
            <span
                className={cn(
                    'text-xs text-center leading-tight',
                    vant
                        ? 'font-bold text-white'
                        : tapte
                          ? 'font-semibold text-white/75'
                          : 'font-semibold text-white/90',
                )}
            >
                {hentNavn(team, locale)}
            </span>
            {vant && (
                <span
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5
                               text-[9.5px] font-bold uppercase tracking-[0.08em] text-amber-950"
                >
                    <Trophy className="w-2.5 h-2.5" /> {t.spilteKamper.videre}
                </span>
            )}
        </div>
    )
}

// Kompakt fase-stack under lag-gridet: 120-minutters-stilling og evt. straffer.
// Avgjørende fase markeres sterkt, mellomtrinnet dempet.
function FaseStack({ s, t }: { s: SluttspillResultat; t: Translations }) {
    const monoFont = "'SF Mono', ui-monospace, Menlo, monospace"
    const rad = (label: string, skår: string, sterk: boolean) => (
        <div className="flex items-center justify-between py-1">
            <span
                className={cn(
                    'text-[11px] font-bold uppercase tracking-[0.06em]',
                    sterk ? 'text-white/85' : 'text-white/50',
                )}
            >
                {label}
            </span>
            <span
                className={cn('bp-tabular text-sm font-bold', sterk ? 'text-white' : 'text-white/70')}
                style={{ fontFamily: monoFont, fontVariantNumeric: 'tabular-nums' }}
            >
                {skår}
            </span>
        </div>
    )

    const etter120 = `${s.etter120[0]}–${s.etter120[1]}`

    return (
        <div className="border-t border-white/10 mt-3 pt-1">
            {s.avgjortPa === 'straffer' ? (
                <>
                    {rad(t.spilteKamper.faseEkstraomganger, etter120, false)}
                    {rad(t.spilteKamper.faseStraffer, `${s.straffer![0]}–${s.straffer![1]}`, true)}
                </>
            ) : (
                rad(t.spilteKamper.faseEkstraomganger, etter120, true)
            )}
        </div>
    )
}

// ---------- MatchHero ----------

function MatchHero({
    match,
    isLive,
    isPågår,
    isFinished,
    locale,
    t,
}: {
    match: MatchBetMedScore
    isLive: boolean
    isPågår: boolean
    isFinished: boolean
    locale: 'no' | 'fr'
    t: Translations
}) {
    const hasScore = match.home_result !== '' && match.away_result !== ''
    // Sluttspill-info vises kun for ferdige kamper som faktisk gikk til
    // ekstraomganger/straffer. Live og gruppespill ser ut som før.
    const s = isFinished ? (match.sluttspill ?? null) : null
    return (
        <div
            className="relative rounded-[18px] overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #14492c, #0f3a23 55%, #0a2a19)' }}
        >
            {/* Subtle vertical pitch lines */}
            <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 1px, transparent 1px, transparent 60px)',
                }}
            />
            <div className="relative px-4 pt-4 pb-0">
                {/* Top row: round + status badge */}
                <div className="flex items-center justify-between mb-5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                        {rundeTilTekst(match.round, locale)}
                    </span>
                    {isPågår ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[11px] font-bold uppercase tracking-wide">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            {t.hjem.paagaar}
                        </span>
                    ) : isFinished ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-wide">
                            <CheckCheck className="w-3 h-3" />
                            {t.hjem.ferdig}
                        </span>
                    ) : null}
                </div>

                {/* Teams + score grid */}
                <div className={cn('grid grid-cols-[1fr_auto_1fr] items-center gap-3', s ? 'pb-2' : 'pb-5')}>
                    {/* Home team */}
                    <TeamColumn
                        team={match.home_team}
                        locale={locale}
                        vant={s?.vinner === 'home'}
                        tapte={s != null && s.vinner !== 'home'}
                        t={t}
                    />

                    {/* Score */}
                    <div className="flex flex-col items-center gap-1.5">
                        <span
                            className="bp-tabular text-[46px] font-black text-white leading-none"
                            style={{ fontFamily: "'SF Mono', ui-monospace, Menlo, monospace" }}
                        >
                            {hasScore ? `${match.home_result}–${match.away_result}` : '?–?'}
                        </span>
                        {s ? (
                            <span
                                className="bp-tabular inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5
                                           text-[9.5px] font-bold uppercase tracking-[0.08em] text-amber-950"
                            >
                                {t.spilteKamper.ordinaerTidTippes}
                            </span>
                        ) : (
                            <span
                                className={cn(
                                    'text-[10px] font-semibold uppercase tracking-wider',
                                    isLive ? 'text-red-300' : 'text-white/50',
                                )}
                            >
                                {isLive ? t.spilteKamper.liveResultat : isFinished ? t.spilteKamper.sluttresultat : ''}
                            </span>
                        )}
                    </div>

                    {/* Away team */}
                    <TeamColumn
                        team={match.away_team}
                        locale={locale}
                        vant={s?.vinner === 'away'}
                        tapte={s != null && s.vinner !== 'away'}
                        t={t}
                    />
                </div>

                {/* Fase-stack: ekstraomganger / straffer */}
                {s && <FaseStack s={s} t={t} />}
            </div>

            {/* Bottom accent stripe */}
            <div
                className={cn(
                    'h-[3px] w-full',
                    isPågår ? 'bg-red-600' : isFinished ? 'bg-amber-500' : 'bg-transparent',
                )}
            />
        </div>
    )
}

// ---------- FasitForTipping ----------

// Gjør tippe-regelen eksplisitt for sluttspillkamper: poeng regnes på ordinær
// tid uavhengig av hvem som gikk videre. Vises kun for ferdige kamper med
// sluttspill (e.omg./straffer).
function FasitForTipping({
    match,
    s,
    locale,
    t,
}: {
    match: MatchBetMedScore
    s: SluttspillResultat
    locale: 'no' | 'fr'
    t: Translations
}) {
    const utfallLabels: Record<Utfall, string> = {
        H: t.spilteKamper.utfallHjemmeseier,
        U: t.spilteKamper.utfallUavgjort,
        B: t.spilteKamper.utfallBorteseier,
    }
    const utfall = match.matchpoeng.utfall
    const vinnerLag = s.vinner === 'home' ? match.home_team : match.away_team
    const hvordan = s.avgjortPa === 'straffer' ? t.spilteKamper.avgjortStraffer : t.spilteKamper.avgjortEkstraomg

    return (
        <div className="bp-card flex items-start gap-2.5">
            <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCheck className="w-4 h-4" />
            </span>
            <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900">
                    {t.spilteKamper.fasitForTipping}:{' '}
                    <span className="bp-tabular" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {match.home_result}–{match.away_result}
                    </span>
                    {utfall && <> · {utfallLabels[utfall]}</>}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">
                    {t.spilteKamper.poengRegnesOrdinaerTid}{' '}
                    {tx(t.spilteKamper.gikkVidereNote, { lag: hentNavn(vinnerLag, locale), hvordan })}
                </p>
            </div>
        </div>
    )
}

// ---------- BetDistribution ----------

function BetDistribution({
    match,
    myBet,
    isPågår,
    isFinished,
    t,
}: {
    match: MatchBetMedScore
    myBet: BetWithUser | null
    isPågår: boolean
    isFinished: boolean
    t: Translations
}) {
    const homeBets = match.matchpoeng.hjemme
    const drawBets = match.matchpoeng.uavgjort
    const awayBets = match.matchpoeng.borte
    const totalBets = homeBets + drawBets + awayBets

    // Adjust percentages to have a minimum of 14% each
    let homePct = totalBets > 0 ? (homeBets / totalBets) * 100 : 33.3
    let drawPct = totalBets > 0 ? (drawBets / totalBets) * 100 : 33.3
    let awayPct = totalBets > 0 ? (awayBets / totalBets) * 100 : 33.3
    const minPct = 14
    let adjusted = false
    if (homePct < minPct) {
        homePct = minPct
        adjusted = true
    }
    if (drawPct < minPct) {
        drawPct = minPct
        adjusted = true
    }
    if (awayPct < minPct) {
        awayPct = minPct
        adjusted = true
    }
    if (adjusted) {
        const sum = homePct + drawPct + awayPct
        homePct = (homePct / sum) * 100
        drawPct = (drawPct / sum) * 100
        awayPct = (awayPct / sum) * 100
    }

    const actualOutcome: Utfall | null = isFinished ? (match.matchpoeng.utfall ?? null) : null

    const myOutcome: Utfall | null =
        myBet !== null && myBet.home_score !== null && myBet.away_score !== null
            ? finnUtfall(myBet.home_score.toString(), myBet.away_score.toString())
            : null

    const outcomeLabels: Record<Utfall, string> = {
        H: t.spilteKamper.hjemme,
        U: t.spilteKamper.uavgjort,
        B: t.spilteKamper.borte,
    }

    const cells: {
        key: Utfall
        label: string
        count: number
        pct: number
        flagOrEmoji: React.ReactNode
        bg: string
        textColor: string
    }[] = [
        {
            key: 'H',
            label: t.spilteKamper.hjemme,
            count: homeBets,
            pct: homePct,
            flagOrEmoji: <span className="text-base leading-none">{hentFlag(match.home_team)}</span>,
            bg: 'bg-blue-50',
            textColor: 'text-blue-800',
        },
        {
            key: 'U',
            label: t.spilteKamper.uavgjort,
            count: drawBets,
            pct: drawPct,
            flagOrEmoji: <span className="text-base leading-none">🤝</span>,
            bg: 'bg-stone-100',
            textColor: 'text-stone-600',
        },
        {
            key: 'B',
            label: t.spilteKamper.borte,
            count: awayBets,
            pct: awayPct,
            flagOrEmoji: <span className="text-base leading-none">{hentFlag(match.away_team)}</span>,
            bg: 'bg-red-50',
            textColor: 'text-red-800',
        },
    ]

    const rawPcts: Record<Utfall, number> = {
        H: totalBets > 0 ? Math.round((homeBets / totalBets) * 100) : 0,
        U: totalBets > 0 ? Math.round((drawBets / totalBets) * 100) : 0,
        B: totalBets > 0 ? Math.round((awayBets / totalBets) * 100) : 0,
    }

    return (
        <div className="bp-card">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <span className="bp-overline">{t.spilteKamper.hvaFolkTippet}</span>
                <span className="text-xs text-stone-500">{tx(t.spilteKamper.tipsAntall, { antall: totalBets })}</span>
            </div>

            {/* Proportional cells */}
            <div className="flex gap-1.5 mb-3">
                {cells.map((cell) => {
                    const isFasit = actualOutcome === cell.key
                    const isMyPick = myOutcome === cell.key
                    return (
                        <div
                            key={cell.key}
                            className={cn(
                                'relative rounded-[11px] px-2.5 py-2 flex flex-col gap-1 transition-colors',
                                isFasit ? 'bg-emerald-50 ring-[1.5px] ring-emerald-500' : cell.bg,
                            )}
                            style={{ flex: cell.pct }}
                        >
                            {/* Gold dot for my pick */}
                            {isMyPick && (
                                <span
                                    aria-hidden
                                    className="absolute top-1.5 right-1.5 w-[9px] h-[9px] rounded-full bg-amber-400 ring-2 ring-amber-100"
                                />
                            )}

                            {/* Fasit badge */}
                            {isFasit && (
                                <span className="inline-flex items-center gap-0.5 self-start rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide mb-0.5">
                                    ✓ {t.spilteKamper.fasit}
                                </span>
                            )}

                            <div className="flex items-center gap-1">
                                {cell.flagOrEmoji}
                                <span className={cn('text-[10px] font-bold uppercase tracking-wide', cell.textColor)}>
                                    {cell.label}
                                </span>
                            </div>
                            <span
                                className={cn('bp-tabular text-xl font-black leading-none', cell.textColor)}
                                style={{ fontFamily: "'SF Mono', ui-monospace, Menlo, monospace" }}
                            >
                                {cell.count}
                            </span>
                            <span className={cn('text-[11px]', cell.textColor)}>{rawPcts[cell.key]}%</span>
                        </div>
                    )
                })}
            </div>

            {/* Legend */}
            {(myOutcome !== null || (isFinished && actualOutcome !== null)) && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mb-3">
                    {myOutcome !== null && (
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400 ring-1 ring-amber-200 flex-shrink-0" />
                            {t.spilteKamper.dittTipp}: {outcomeLabels[myOutcome]}
                        </span>
                    )}
                    {isFinished && actualOutcome !== null && (
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-[2px] bg-emerald-500 flex-shrink-0" />
                            {t.spilteKamper.fasit}: {outcomeLabels[actualOutcome]}
                        </span>
                    )}
                </div>
            )}

            {/* Footer summary */}
            <div className="border-t border-stone-100 pt-3">
                {isPågår ? (
                    <p className="text-xs text-stone-500">{t.spilteKamper.poengBeregnesNaarFerdig}</p>
                ) : isFinished ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            {tx(t.spilteKamper.traffResultat, {
                                antall: match.matchpoeng.antallRiktigeSvar,
                            })}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                            {tx(t.spilteKamper.traffUtfall, {
                                antall: match.matchpoeng.antallRiktigeUtfall,
                            })}
                        </span>
                        <span className="text-xs text-stone-400 ml-auto whitespace-nowrap">
                            {tx(t.spilteKamper.poengForRiktigResultat, { poeng: match.matchpoeng.riktigResultat })}
                            {' · '}
                            {tx(t.spilteKamper.poengForRiktigUtfall, { poeng: match.matchpoeng.riktigUtfall })}
                        </span>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

// ---------- MyBetCard ----------

function MyBetCard({
    bet,
    isLive,
    isFinished,
    locale,
    t,
}: {
    bet: BetWithUser
    isLive: boolean
    isFinished: boolean
    locale: 'no' | 'fr'
    t: Translations
}) {
    const hasScore = bet.home_score !== null && bet.away_score !== null

    const verdiktIcon = bet.riktigResultat ? (
        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
    ) : bet.riktigUtfall ? (
        <Target className="w-3.5 h-3.5 text-amber-600" />
    ) : (
        <X className="w-3.5 h-3.5 text-stone-400" />
    )

    const verdiktText = bet.riktigResultat
        ? t.spilteKamper.riktigResultat
        : bet.riktigUtfall
          ? t.spilteKamper.riktigUtfall
          : t.spilteKamper.bom

    const verdiktColor = bet.riktigResultat
        ? 'text-emerald-700'
        : bet.riktigUtfall
          ? 'text-amber-700'
          : 'text-stone-400'

    const liveVerdikt = isLive ? tx(t.spilteKamper.liggerAnTil, { status: verdiktText }) : null

    return (
        <div className="relative rounded-xl overflow-hidden shadow-sm ring-[1.5px] ring-amber-200 bg-amber-50">
            <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />

            {/* Header */}
            <div className="flex items-center justify-between pl-5 pr-4 pt-3 pb-2">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                        {initials(bet.user.name)}
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-800">
                        {t.spilteKamper.dittTipp}
                    </span>
                </div>
                {isLive ? (
                    <span className="bp-tabular inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 ring-1 ring-stone-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                        {bet.poeng > 0 ? `+${bet.poeng}` : '0'} {t.felles.poeng}
                    </span>
                ) : isFinished ? (
                    <span className="bp-tabular inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 ring-1 ring-stone-200">
                        {bet.poeng > 0 ? `+${bet.poeng}` : bet.poeng} {t.felles.poeng}
                    </span>
                ) : null}
            </div>

            {/* Body */}
            <div className="flex items-center justify-between pl-5 pr-4 pb-3 gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-sm font-medium text-stone-700 truncate">
                        {fixLand(bet.home_team, locale)} vs {fixLand(bet.away_team, locale)}
                    </span>
                    {isLive ? (
                        <span className="text-xs text-stone-500">{liveVerdikt}</span>
                    ) : isFinished ? (
                        <div className="flex items-center gap-1">
                            {verdiktIcon}
                            <span className={cn('text-xs font-semibold', verdiktColor)}>{verdiktText}</span>
                        </div>
                    ) : null}
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {bet.joker && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                                <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                                {t.spilteKamper.jokerDobbel}
                            </span>
                        )}
                        {erNorgeKamp(bet.home_team, bet.away_team) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800 ring-1 ring-red-200">
                                <Flag className="w-3 h-3" />
                                {t.spilteKamper.norgeDobbel}
                            </span>
                        )}
                    </div>
                </div>
                <span
                    className="bp-tabular text-[30px] font-black text-stone-900 flex-shrink-0"
                    style={{ fontFamily: "'SF Mono', ui-monospace, Menlo, monospace" }}
                >
                    {hasScore ? `${bet.home_score}–${bet.away_score}` : '–'}
                </span>
            </div>
        </div>
    )
}

// ---------- BetRow ----------

function BetPoengPill({ bet, isLive, isFinished }: { bet: BetWithUser; isLive: boolean; isFinished: boolean }) {
    if (!isLive && !isFinished) return null

    if (bet.riktigResultat) {
        return (
            <span className="bp-tabular inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 w-16 justify-center shrink-0">
                {isLive ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                ) : (
                    <CheckCheck className="w-3 h-3" />
                )}
                {bet.poeng > 0 ? `+${bet.poeng}` : '0'}
            </span>
        )
    }
    if (bet.riktigUtfall) {
        return (
            <span className="bp-tabular inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 w-16 justify-center shrink-0">
                {isLive ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                ) : (
                    <Target className="w-3 h-3" />
                )}
                {bet.poeng > 0 ? `+${bet.poeng}` : '0'}
            </span>
        )
    }
    return (
        <span className="bp-tabular inline-flex items-center gap-1 rounded-full bg-stone-50 px-2 py-1 text-xs font-semibold text-stone-500 ring-1 ring-stone-200 w-16 justify-center shrink-0">
            {isLive ? (
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse flex-shrink-0" />
            ) : (
                <X className="w-3 h-3" />
            )}
            {bet.poeng > 0 ? `+${bet.poeng}` : '0'}
        </span>
    )
}

function BetRow({ bet, isLive, isFinished }: { bet: BetWithUser; isLive: boolean; isFinished: boolean }) {
    const color = avatarColor(bet.user.name)
    const hasScore = bet.home_score !== null && bet.away_score !== null

    return (
        <NextLink
            href={`/user/${bet.user.id}`}
            className="flex items-center gap-3 px-4 py-2.5 min-h-[44px] hover:bg-stone-50 active:bg-stone-100 transition-colors"
        >
            <div
                className={cn(
                    'w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0',
                    color,
                )}
            >
                {initials(bet.user.name)}
            </div>
            <span className="text-sm text-stone-800 truncate min-w-0 flex-1">{bet.user.name}</span>
            {bet.joker && (
                <span
                    className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200 shrink-0"
                    title="Joker ×2"
                >
                    <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                    ×2
                </span>
            )}
            <span
                className="bp-tabular text-sm font-semibold text-stone-700 shrink-0 w-10 text-center"
                style={{ fontFamily: "'SF Mono', ui-monospace, Menlo, monospace" }}
            >
                {hasScore ? `${bet.home_score}–${bet.away_score}` : '–'}
            </span>
            <BetPoengPill bet={bet} isLive={isLive} isFinished={isFinished} />
        </NextLink>
    )
}

// ---------- AllBetsList ----------

function AllBetsList({
    bets,
    totalCount,
    isLive,
    isFinished,
    locale,
    t,
}: {
    bets: BetWithUser[]
    totalCount: number
    isLive: boolean
    isFinished: boolean
    locale: 'no' | 'fr'
    t: Translations
}) {
    const [sortOrder, setSortOrder] = useState<SortOrder>(isFinished || isLive ? 'poeng' : 'navn')

    const sorted = [...bets].sort((a, b) => {
        if (sortOrder === 'poeng') {
            const diff = b.poeng - a.poeng
            return diff !== 0 ? diff : a.user.name.localeCompare(b.user.name, locale)
        }
        if (sortOrder === 'navn') {
            return a.user.name.localeCompare(b.user.name, locale)
        }
        // skor: home_score asc, then away_score asc; null sorts last
        const aHome = a.home_score ?? Infinity
        const bHome = b.home_score ?? Infinity
        if (aHome !== bHome) return aHome - bHome
        const aAway = a.away_score ?? Infinity
        const bAway = b.away_score ?? Infinity
        return aAway - bAway
    })

    const sortOptions: { key: SortOrder; label: string }[] = [
        { key: 'poeng', label: t.spilteKamper.sorterPoeng },
        { key: 'navn', label: t.spilteKamper.sorterNavn },
        { key: 'skor', label: t.spilteKamper.sorterTippetSkor },
    ]

    return (
        <div className="bp-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <span className="bp-overline">
                    {t.spilteKamper.alleTips} · {totalCount}
                </span>
                <div className="flex items-center gap-0.5 bg-stone-100 rounded-lg p-0.5">
                    {sortOptions.map((o) => (
                        <button
                            key={o.key}
                            onClick={() => setSortOrder(o.key)}
                            className={cn(
                                'px-2 py-1 text-[11px] font-semibold rounded-md transition-colors min-h-[32px]',
                                sortOrder === o.key
                                    ? 'bg-white text-stone-800 shadow-xs'
                                    : 'text-stone-500 hover:text-stone-700',
                            )}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Rows — bleed to card edges */}
            <div className="-mx-4 border-t border-stone-100 divide-y divide-stone-100">
                {sorted.map((bet) => (
                    <BetRow key={bet.user_id} bet={bet} isLive={isLive} isFinished={isFinished} />
                ))}
            </div>
        </div>
    )
}

// ---------- Main page ----------

const MatchPage: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { data: me } = UseUser()
    const { t, locale } = useLanguage()
    const router = useRouter()
    const { id } = router.query

    const hovedliga = useMemo(() => {
        if (!data || !me) return null
        const populasjon = new Set(data.raw.users.map((u) => u.id))
        populasjon.add(me.id)
        return calculateAllBetsExtended(filtrerAllBets(data.raw, populasjon))
    }, [data, me])

    if (!data || isLoading || !me || !hovedliga) {
        return <Spinner />
    }

    const matchBets = hovedliga.bets.filter((a) => a.match_num == Number(id))
    if (matchBets.length === 0) {
        return <p className="text-center text-stone-500 py-8">{t.spilteKamper.kampIkkeFunnet}</p>
    }

    // Use the first bet to get match metadata (all bets share the same match info)
    const match = matchBets[0]
    const isLive = match.foreløpig === true
    const hasResult = match.matchpoeng.utfall !== null
    const isFinished = hasResult && !isLive
    const isPågår = isLive || (!hasResult && new Date(match.game_start) <= new Date())

    const betsWithUser: BetWithUser[] = matchBets.map((a) => ({
        ...a,
        user: hovedliga.users.find((u) => u.id == a.user_id)!,
    }))

    const myBet = betsWithUser.find((a) => a.user.id == me.id) ?? null
    const otherBets = betsWithUser.filter((a) => a.user.id != me.id)

    return (
        <div className="flex flex-col gap-3 pb-8">
            <MatchHero match={match} isLive={isLive} isPågår={isPågår} isFinished={isFinished} locale={locale} t={t} />
            {isFinished && match.sluttspill != null && (
                <FasitForTipping match={match} s={match.sluttspill} locale={locale} t={t} />
            )}
            <BetDistribution match={match} myBet={myBet} isPågår={isPågår} isFinished={isFinished} t={t} />
            {myBet && <MyBetCard bet={myBet} isLive={isLive} isFinished={isFinished} locale={locale} t={t} />}
            <AllBetsList
                bets={otherBets}
                totalCount={betsWithUser.length}
                isLive={isLive}
                isFinished={isFinished}
                locale={locale}
                t={t}
            />
        </div>
    )
}

export default MatchPage
