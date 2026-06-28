/**
 * @jest-environment node
 */
import { backfillFeed } from './backfill'

// Mock-klient som svarer ut fra SQL-innhold. Dekker både hentHovedligaData og
// backfillens egne spørringer. Standings-snapshot-tabellen settes «tom» og
// gårsdagens kamper til 0, så morgenrapporten holder seg stille.
function lagClient(opts: {
    førsteKampStart: string | null
    bets: unknown[]
    scores: unknown[]
    users: unknown[]
    matches: unknown[]
}) {
    const morgenInserts: { params: unknown[] }[] = []
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('AS start')) return { rows: [{ start: opts.førsteKampStart }] }
        if (sql.includes('FROM bets b')) return { rows: opts.bets }
        if (sql.includes('FROM match_scores')) return { rows: opts.scores }
        if (sql.includes('FROM users u')) return { rows: opts.users }
        if (sql.includes('AS antall')) return { rows: [{ antall: '0' }] } // tellFerdigeKamper → stille dag
        if (sql.includes('FROM matches')) return { rows: opts.matches }
        if (sql.includes("kind = 'morgenrapport'")) return { rows: [], rowCount: 0 }
        if (sql.includes('max(dato)')) return { rows: [{ dato: null }] }
        if (sql.includes('INSERT INTO feed_standings_snapshot')) return { rowCount: 1 }
        if (sql.includes('INSERT INTO feed_posts') && sql.includes('dato')) {
            morgenInserts.push({ params: params ?? [] })
            return { rowCount: 1 }
        }
        return { rows: [] }
    })
    return { client: { query } as any, morgenInserts }
}

const brukere = [
    {
        id: 'u1',
        name: 'Ola',
        paid: true,
        picture: null,
        winner: null,
        topscorer_player_id: null,
        winner_endret: false,
        topscorer_endret: false,
    },
    {
        id: 'u2',
        name: 'Kari',
        paid: true,
        picture: null,
        winner: null,
        topscorer_player_id: null,
        winner_endret: false,
        topscorer_endret: false,
    },
]

it('regner ut datospennet fra første ferdige kamp og poster ikke kamp-poster', async () => {
    const { client, morgenInserts } = lagClient({
        førsteKampStart: '2026-06-18T18:00:00.000Z',
        bets: [
            { user_id: 'u1', match_num: 1, home_score: '2', away_score: '1', joker: false },
            { user_id: 'u2', match_num: 1, home_score: '0', away_score: '0', joker: false },
        ],
        scores: [
            {
                match_num: 1,
                home_score: null,
                away_score: null,
                home_team_override: null,
                away_team_override: null,
                synced_home_ft: 2,
                synced_away_ft: 1,
                use_manual: false,
            },
        ],
        users: brukere,
        matches: [
            {
                match_num: 1,
                round: 1,
                home_team: 'BRA',
                away_team: 'ARG',
                game_start: new Date('2026-06-18T16:00:00Z'),
                group: 'Group A',
                status: 'FINISHED',
            },
        ],
    })

    const res = await backfillFeed(client, new Date('2026-06-20T09:00:00Z'))

    // Backfillen lager ikke lenger kamp-poster — kun morgenrapporter (her stille).
    expect(res).not.toHaveProperty('kampposter')
    expect(res.morgenrapporter).toBe(0) // stille dager (0 ferdige kamper i vinduet)
    expect(res.fraDato).toBe('2026-06-18')
    expect(res.tilDato).toBe('2026-06-20')
    expect(morgenInserts).toHaveLength(0)
})

it('gjør ingenting når ingen kamper er ferdige', async () => {
    const { client, morgenInserts } = lagClient({
        førsteKampStart: null,
        bets: [],
        scores: [],
        users: brukere,
        matches: [],
    })

    const res = await backfillFeed(client, new Date('2026-06-20T09:00:00Z'))

    expect(res.morgenrapporter).toBe(0)
    expect(res.fraDato).toBeNull()
    expect(res.dager).toBe(0)
    expect(morgenInserts).toHaveLength(0)
})
