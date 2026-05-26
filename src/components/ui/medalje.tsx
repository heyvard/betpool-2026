import React from 'react'

/**
 * Rangerings-medalje for topp-3 — bånd over rund disk med plass-nummer i midten.
 * Bruker brand-paletten istedenfor OS-emojiene 🥇🥈🥉, som har inkonsistente
 * farger på tvers av plattformer (lyseblå/rød/grønn på iOS, helt annerledes på Android).
 */
const FARGER: Record<1 | 2 | 3, { primary: string; secondary: string; rim: string }> = {
    1: { primary: '#fbbf24', secondary: '#f59e0b', rim: '#92400e' },
    2: { primary: '#e2e8f0', secondary: '#cbd5e1', rim: '#475569' },
    3: { primary: '#d4a574', secondary: '#a16207', rim: '#7c2d12' },
}

export function Medalje({ plass, size = 28 }: { plass: 1 | 2 | 3; size?: number }) {
    const f = FARGER[plass]
    return (
        <svg viewBox="0 0 32 32" width={size} height={size} aria-label={`${plass}. plass`} role="img">
            <path d="M8 2 L13 2 L11 13 L7 13 Z" fill="#dc2626" />
            <path d="M24 2 L19 2 L21 13 L25 13 Z" fill="#1e40af" />
            <circle cx="16" cy="20" r="9" fill={f.primary} stroke={f.rim} strokeWidth="1" />
            <circle cx="16" cy="20" r="7" fill="none" stroke={f.secondary} strokeWidth="0.6" />
            <text
                x="16"
                y="24"
                textAnchor="middle"
                fontFamily="Helvetica Neue, Arial"
                fontWeight="900"
                fontSize="11"
                fill={f.rim}
            >
                {plass}
            </text>
        </svg>
    )
}
