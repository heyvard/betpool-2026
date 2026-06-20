import React from 'react'

// Betpool-logo som squircle med monogram «b». Brukes som avsender-ikon på hver post.
export function BetpoolLogo({ size = 34 }: { size?: number }) {
    return (
        <div
            className="flex shrink-0 items-center justify-center font-extrabold text-white"
            style={{
                width: size,
                height: size,
                borderRadius: '30%',
                background: 'linear-gradient(150deg,#fcd34d,#f59e0b)',
                color: '#7c2d12',
                fontSize: Math.round(size * 0.5),
                boxShadow: 'inset 0 1px 2px rgba(124,45,18,.25)',
            }}
        >
            b
        </div>
    )
}

// Enkelt to-farges flagg-rektangel (ingen detaljerte våpenskjold). Fargene
// utledes deterministisk fra tre-bokstavskoden så samme lag alltid ser likt ut.
const PALETT: [string, string][] = [
    ['#dc2626', '#ffffff'],
    ['#1e40af', '#fcd34d'],
    ['#16a34a', '#ffffff'],
    ['#1c1917', '#dc2626'],
    ['#f59e0b', '#1e40af'],
    ['#15803d', '#fcd34d'],
    ['#b91c1c', '#1e40af'],
    ['#78716c', '#ffffff'],
]

function hash(s: string): number {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
    return Math.abs(h)
}

export function Flagg({ tla, width = 30, height = 20 }: { tla: string; width?: number; height?: number }) {
    const h = hash(tla || 'XXX')
    const [a, b] = PALETT[h % PALETT.length]
    const vannrett = (h >> 3) % 2 === 0
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 30 20"
            aria-hidden
            style={{ borderRadius: 2, display: 'block' }}
        >
            <rect width="30" height="20" fill={a} />
            {vannrett ? (
                <rect width="30" height="10" y="10" fill={b} />
            ) : (
                <rect width="15" height="20" x="15" fill={b} />
            )}
            <rect width="30" height="20" fill="none" stroke="rgba(0,0,0,.08)" />
        </svg>
    )
}

// Liten rund avatar (bilde eller initial). Speiler ledertavlas avatar i mindre format.
export function FeedAvatar({ src, navn, size = 30 }: { src?: string | null; navn?: string; size?: number }) {
    return (
        <div
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-200"
            style={{ width: size, height: size }}
        >
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={navn ?? ''} className="h-full w-full rounded-full object-cover" />
            ) : (
                <span
                    className="flex h-full w-full items-center justify-center rounded-full bg-blue-500 text-white"
                    style={{ fontSize: Math.round(size * 0.42) }}
                >
                    {navn ? navn.charAt(0).toUpperCase() : ''}
                </span>
            )}
        </div>
    )
}
