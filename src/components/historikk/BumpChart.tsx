// Bump-chart i ren SVG (ingen chart-bibliotek). Hver deltaker er en linje som
// klatrer og faller mellom plasseringene; X = kampdager, Y = plassering (1
// øverst). Den markerte linja løftes frem (full farge, tykk, prikker + en
// #{plass}-pille i enden); resten dempes og legges bak.

interface Serie {
    userid: string
    navn: string
    farge: string
    ranks: number[]
}

export function BumpChart({
    serier,
    kampdagerShort,
    selectedId,
    maxRank,
}: {
    serier: Serie[]
    kampdagerShort: string[]
    selectedId: string
    maxRank: number
}) {
    const W = 312
    const padL = 22
    const padR = 16
    const padT = 24
    const padB = 34
    const H = 300
    const n = kampdagerShort.length
    const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1)
    const y = (rank: number) => padT + (rank - 1) * ((H - padT - padB) / Math.max(1, maxRank - 1))

    const grid = kampdagerShort.map((_, i) => (
        <line key={i} x1={x(i)} y1={padT - 4} x2={x(i)} y2={H - padB + 4} stroke="#ececea" strokeWidth={1} />
    ))
    const yTicks = [1, Math.ceil(maxRank / 2), maxRank].filter((v, i, a) => a.indexOf(v) === i && v >= 1)

    // Markert sist (øverst i tegnerekkefølge).
    const ordnet = [...serier].sort((a, b) => Number(a.userid === selectedId) - Number(b.userid === selectedId))

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', overflow: 'visible' }}>
            {grid}
            {yTicks.map((rk) => (
                <text
                    key={rk}
                    x={padL - 9}
                    y={y(rk) + 3.5}
                    textAnchor="end"
                    fontSize={9}
                    fontWeight={700}
                    fill="#bcb8b1"
                >
                    {rk}
                </text>
            ))}
            {kampdagerShort.map((s, i) => (
                <text
                    key={i}
                    x={x(i)}
                    y={H - padB + 18}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight={700}
                    fill="#a8a29e"
                >
                    {s}
                </text>
            ))}
            {ordnet.map((p) => {
                const on = p.userid === selectedId
                const pts = p.ranks.map((rk, i) => `${x(i)},${y(rk)}`).join(' ')
                const endRank = p.ranks[n - 1]
                // Med bare én kampdag blir det ingen linje å tegne — vis store
                // prikker per deltaker i den ene kolonnen i stedet.
                const enKolonne = n === 1
                return (
                    <g key={p.userid}>
                        {!enKolonne && (
                            <polyline
                                points={pts}
                                fill="none"
                                stroke={p.farge}
                                strokeWidth={on ? 3.4 : 2}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                opacity={on ? 1 : 0.18}
                            />
                        )}
                        {enKolonne && (
                            <circle
                                cx={x(0)}
                                cy={y(p.ranks[0])}
                                r={on ? 6 : 4}
                                fill={on ? p.farge : '#fff'}
                                stroke={p.farge}
                                strokeWidth={2.6}
                                opacity={on ? 1 : 0.25}
                            />
                        )}
                        {on &&
                            !enKolonne &&
                            p.ranks.map((rk, i) => (
                                <circle
                                    key={i}
                                    cx={x(i)}
                                    cy={y(rk)}
                                    r={4.5}
                                    fill="#fff"
                                    stroke={p.farge}
                                    strokeWidth={2.6}
                                />
                            ))}
                        {on && (
                            <g transform={`translate(${x(n - 1) + 8},${y(endRank)})`}>
                                <rect x={0} y={-9} width={22} height={18} rx={9} fill={p.farge} />
                                <text x={11} y={3.5} textAnchor="middle" fontSize={10} fontWeight={800} fill="#fff">
                                    #{endRank}
                                </text>
                            </g>
                        )}
                    </g>
                )
            })}
        </svg>
    )
}
