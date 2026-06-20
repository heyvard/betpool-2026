/**
 * @jest-environment node
 */
import { genererKampposter } from './genererKamppost'

// Mock-klient som svarer ut fra SQL-innhold (ikke kall-rekkefølge), så testen
// ikke knekker av små refaktorer. NOT EXISTS-spørringen filtreres på match_num-ene
// som faktisk sendes inn (params[0]), slik at vi kan teste at kun oppgitte kamper
// behandles.
function lagClient(rader: {
    ferdige: { match_num: number; [k: string]: unknown }[]
    bets: unknown[]
    scores: unknown[]
    users: unknown[]
    matches: unknown[]
}) {
    const insertCalls: { params: unknown[] }[] = []
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('NOT EXISTS') && sql.includes('feed_posts')) {
            const ids = (params?.[0] as number[]) ?? []
            return { rows: rader.ferdige.filter((r) => ids.includes(r.match_num)) }
        }
        if (sql.includes('FROM bets b')) return { rows: rader.bets }
        if (sql.includes('FROM match_scores')) return { rows: rader.scores }
        if (sql.includes('FROM users u')) return { rows: rader.users }
        if (sql.includes('FROM matches')) return { rows: rader.matches }
        if (sql.includes('INSERT INTO feed_posts')) {
            insertCalls.push({ params: params ?? [] })
            return { rowCount: 1 }
        }
        return { rows: [] }
    })
    return { client: { query } as any, insertCalls }
}

const iFortiden = new Date('2026-06-19T18:00:00Z')

function fixtures() {
    return {
        ferdige: [
            {
                match_num: 1,
                round: 1,
                home_team: 'BRA',
                away_team: 'ARG',
                home_score: null,
                away_score: null,
                home_team_override: null,
                away_team_override: null,
                synced_home_ft: 2,
                synced_away_ft: 1,
                use_manual: false,
            },
        ],
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
        users: [
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
        ],
        matches: [
            {
                match_num: 1,
                round: 1,
                home_team: 'BRA',
                away_team: 'ARG',
                game_start: new Date('2026-06-19T16:00:00Z'),
                group: 'Group A',
                status: 'FINISHED',
            },
        ],
    }
}

it('velger «sjeldent» når kun én hadde eksakt resultat (kampen er nylig ferdig)', async () => {
    const { client, insertCalls } = lagClient(fixtures())

    const res = await genererKampposter(client, [1], iFortiden)

    expect(res.postet).toBe(1)
    expect(insertCalls).toHaveLength(1)
    const params = insertCalls[0].params
    expect(params[0]).toBe('sjeldent') // scenario
    expect(params[2]).toBe('gold') // accent
    expect(params[3]).toContain('Ola') // tittel nevner den sjeldne treffen
    const data = JSON.parse(params[5] as string)
    expect(data.scenario).toBe('sjeldent')
    expect(data.homeTeam).toBe('BRA')
    expect(data.resultat).toBe('2–1')
})

it('poster ingenting når ingen kamper akkurat ble ferdige (tom liste)', async () => {
    const { client, insertCalls } = lagClient(fixtures())
    const res = await genererKampposter(client, [], iFortiden)
    expect(res).toEqual({ behandlet: 0, postet: 0 })
    expect(insertCalls).toHaveLength(0)
})

it('behandler kun kampene i nylig-ferdig-lista — ikke historiske ferdige kamper', async () => {
    // Kamp 1 er ferdig, men ble ikke ferdig denne synken (lista peker på kamp 2).
    const { client, insertCalls } = lagClient(fixtures())
    const res = await genererKampposter(client, [2], iFortiden)
    expect(res).toEqual({ behandlet: 0, postet: 0 })
    expect(insertCalls).toHaveLength(0)
})
