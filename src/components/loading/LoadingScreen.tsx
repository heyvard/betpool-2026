export const LoadingScreen = () => (
    <div
        role="status"
        aria-live="polite"
        aria-label="Laster"
        className="bp-trophy-bg fixed inset-0 flex flex-col items-center justify-center gap-9"
    >
        <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
                background: 'radial-gradient(circle at 50% 40%, #fde047 0%, transparent 50%)',
                opacity: 0.08,
            }}
        />

        <svg viewBox="0 0 240 280" width="180" height="210" className="relative" aria-hidden>
            <defs>
                <clipPath id="ls-trophy-clip">
                    <path d="M 60 60 L 180 60 C 180 150, 150 200, 120 200 C 90 200, 60 150, 60 60 Z" />
                </clipPath>
                <linearGradient id="ls-gold-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fde047" />
                    <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
            </defs>

            {/* Hanker */}
            <path
                d="M 60 90 C 30 90 30 150 60 158"
                stroke="#fcd34d"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
            />
            <path
                d="M 180 90 C 210 90 210 150 180 158"
                stroke="#fcd34d"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
            />

            {/* Kropp-omriss */}
            <path
                d="M 60 60 L 180 60 C 180 150, 150 200, 120 200 C 90 200, 60 150, 60 60 Z"
                fill="rgba(255,255,255,0.08)"
                stroke="#fcd34d"
                strokeWidth="4"
            />

            {/* Gull-væske inni (stiger) */}
            <g clipPath="url(#ls-trophy-clip)">
                <g className="animate-[ls-rise_2.4s_cubic-bezier(.6,.05,.4,1)_infinite]">
                    <rect x="0" y="60" width="240" height="160" fill="url(#ls-gold-fill)" />
                    <path d="M 50 70 Q 90 60 120 70 T 200 70 L 200 90 L 50 90 Z" fill="#fde047" />
                </g>
            </g>

            {/* Stamme + base */}
            <rect x="106" y="200" width="28" height="22" fill="#fcd34d" />
            <rect x="80" y="222" width="80" height="14" rx="3" fill="#fcd34d" />
            <rect x="68" y="236" width="104" height="14" rx="3" fill="#d97706" />

            {/* Bobler */}
            <circle cx="100" cy="160" r="3" fill="#fff" opacity="0.7" />
            <circle cx="140" cy="180" r="2" fill="#fff" opacity="0.5" />
        </svg>

        <div className="text-center">
            <div className="bp-overline mb-3.5 text-amber-300">Laster pool</div>
            <div className="relative h-1 w-44 overflow-hidden rounded-full bg-white/15">
                <div className="absolute inset-y-0 left-0 w-[8%] animate-[ls-bar_2.2s_cubic-bezier(.6,.05,.4,1)_infinite] rounded-full bg-gradient-to-r from-amber-300 to-white" />
            </div>
        </div>
    </div>
)
