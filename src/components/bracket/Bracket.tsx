import React from 'react'
import { Match } from '../../types/types'
import { BRACKET_KOLONNER, BRONSE_SLOT, byggMatchOppslag, effektiveLag } from '../../data/bracket'
import { BracketNode, NODE_BREDDE, NODE_HOYDE } from './BracketNode'
import { useLanguage } from '../../i18n/LanguageContext'

// Layout-konstanter. Nodene plasseres absolutt på en analytisk Y-posisjon, slik
// at hver node ligger nøyaktig midt mellom sine to feedere. Node-høyden er
// konstant (BracketNode), så layouten er deterministisk.
const PITCH = NODE_HOYDE + 18 // vertikal avstand per R32-node (px) — node + luft
const COL_GAP = 30 // horisontal luft mellom kolonner (px)
const COL_PITCH = NODE_BREDDE + COL_GAP
const HEADER_H = 26 // høyde på kolonne-overskriftene
const BRONSE_GAP = 56 // vertikal luft mellom finale og bronse

const R32_ANTALL = BRACKET_KOLONNER[0].slots.length // 16
const H_TOTAL = R32_ANTALL * PITCH

// Korte kolonne-overskrifter (matcher skjermbildene: 1/16, 1/8, …).
const KOLONNE_TITTEL: Record<number, string> = {
    4: '1/16',
    5: '1/8',
    6: '1/4',
    7: '1/2',
    9: 'Finale',
}

interface Posisjon {
    x: number // venstre kant av noden
    cy: number // vertikalt sentrum
    col: number
}

export function Bracket({ matches }: { matches: Match[] }) {
    const { locale } = useLanguage()
    const oppslag = byggMatchOppslag(matches)
    const bronseTekst = locale === 'fr' ? 'Bronze' : 'Bronse'

    // Regn ut posisjon (x + vertikalt sentrum) for hver slot, keyed på match_num.
    const pos = new Map<number, Posisjon>()
    BRACKET_KOLONNER.forEach((kol, col) => {
        const n = kol.slots.length
        kol.slots.forEach((slot, k) => {
            pos.set(slot.matchNum, {
                x: col * COL_PITCH,
                cy: ((k + 0.5) * H_TOTAL) / n,
                col,
            })
        })
    })

    const sisteCol = BRACKET_KOLONNER.length - 1
    const finaleX = sisteCol * COL_PITCH
    const finaleCy = H_TOTAL / 2

    // Bronsefinalen henger under finalen.
    const bronseX = finaleX
    const bronseCy = finaleCy + BRONSE_GAP + NODE_HOYDE // under finale-noden

    const totalWidth = finaleX + NODE_BREDDE + 8
    // R32-kolonnen er den høyeste (H_TOTAL). Høyden må dekke den (og bronsen
    // under finalen), ellers blir nodene liggende utenfor containeren — som da
    // fanger vertikal scroll og hindrer at man får scrollet helt ned.
    const totalHeight = Math.max(H_TOTAL, bronseCy + NODE_HOYDE / 2) + 16

    // Forbindelseslinjer: for hver slot med feedere, tegn en albue fra hver
    // feeder (til venstre) inn til slot-noden.
    const linjer: React.ReactNode[] = []
    BRACKET_KOLONNER.forEach((kol) => {
        kol.slots.forEach((slot) => {
            if (!slot.feeders) return
            const p = pos.get(slot.matchNum)!
            slot.feeders.forEach((f, i) => {
                const fp = pos.get(f)
                if (!fp) return
                const feederRight = fp.x + NODE_BREDDE
                const parentLeft = p.x
                const midX = (feederRight + parentLeft) / 2
                linjer.push(
                    <path
                        key={`${slot.matchNum}-${f}-${i}`}
                        d={`M ${feederRight} ${fp.cy} H ${midX} V ${p.cy} H ${parentLeft}`}
                        fill="none"
                        stroke="#d6d3d1"
                        strokeWidth={1.5}
                    />,
                )
            })
        })
    })

    // Bronse-linjer (taperne fra semifinalene) — stiplet for å skille dem fra
    // det ordinære treet.
    BRONSE_SLOT.feeders?.forEach((f, i) => {
        const fp = pos.get(f)
        if (!fp) return
        const feederRight = fp.x + NODE_BREDDE
        const midX = (feederRight + bronseX) / 2
        linjer.push(
            <path
                key={`bronse-${f}-${i}`}
                d={`M ${feederRight} ${fp.cy} H ${midX} V ${bronseCy} H ${bronseX}`}
                fill="none"
                stroke="#e7e5e4"
                strokeWidth={1.5}
                strokeDasharray="3 3"
            />,
        )
    })

    return (
        <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-6">
            <div style={{ width: totalWidth }} className="relative">
                {/* Kolonne-overskrifter */}
                <div className="relative" style={{ height: HEADER_H }}>
                    {BRACKET_KOLONNER.map((kol, col) => (
                        <div
                            key={kol.runde}
                            className="bp-overline absolute text-center"
                            style={{ left: col * COL_PITCH, width: NODE_BREDDE }}
                        >
                            {KOLONNE_TITTEL[kol.runde]}
                        </div>
                    ))}
                </div>

                {/* Selve treet */}
                <div className="relative" style={{ height: totalHeight }}>
                    {/* Forbindelseslinjer */}
                    <svg
                        className="pointer-events-none absolute inset-0"
                        width={totalWidth}
                        height={totalHeight}
                        aria-hidden
                    >
                        {linjer}
                    </svg>

                    {/* Noder */}
                    {BRACKET_KOLONNER.map((kol) =>
                        kol.slots.map((slot) => {
                            const p = pos.get(slot.matchNum)!
                            const lag = effektiveLag(slot, oppslag)
                            return (
                                <div
                                    key={slot.matchNum}
                                    className="absolute"
                                    style={{ left: p.x, top: p.cy, transform: 'translateY(-50%)' }}
                                >
                                    <BracketNode
                                        slot={slot}
                                        match={oppslag.get(slot.matchNum)}
                                        homeTla={lag.home}
                                        awayTla={lag.away}
                                        locale={locale}
                                    />
                                </div>
                            )
                        }),
                    )}

                    {/* Bronsefinale */}
                    <div className="absolute" style={{ left: bronseX, top: bronseCy, transform: 'translateY(-50%)' }}>
                        <div className="bp-overline mb-1 flex items-center gap-1">
                            <span aria-hidden>🥉</span> {bronseTekst}
                        </div>
                        {(() => {
                            const lag = effektiveLag(BRONSE_SLOT, oppslag)
                            return (
                                <BracketNode
                                    slot={BRONSE_SLOT}
                                    match={oppslag.get(BRONSE_SLOT.matchNum)}
                                    homeTla={lag.home}
                                    awayTla={lag.away}
                                    locale={locale}
                                />
                            )
                        })()}
                    </div>
                </div>
            </div>
        </div>
    )
}
