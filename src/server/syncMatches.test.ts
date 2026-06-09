/**
 * @jest-environment node
 */
import { syncMatches } from './syncMatches'
import { FootballDataMatch } from '../data/footballDataMatch'

function lagKamp(overrides: Partial<FootballDataMatch> = {}): FootballDataMatch {
    return {
        id: 1,
        utcDate: '2026-06-15T12:00:00Z',
        status: 'SCHEDULED',
        stage: 'GROUP_STAGE',
        group: 'GROUP_A',
        matchday: 1,
        homeTeam: { tla: 'BRA' },
        awayTeam: { tla: 'ARG' },
        score: {
            winner: null,
            duration: null,
            fullTime: { home: null, away: null },
            halfTime: { home: null, away: null },
            extraTime: null,
            penalties: null,
        },
        ...overrides,
    }
}

function mockOkResponse(matches: FootballDataMatch[]) {
    return {
        ok: true,
        json: () => Promise.resolve({ matches }),
    } as unknown as Response
}

function mockErrResponse(status: number) {
    return {
        ok: false,
        status,
        statusText: 'Error',
        text: () => Promise.resolve('feilmelding fra api'),
    } as unknown as Response
}

const mockClient = { query: jest.fn() }

beforeEach(() => {
    process.env.FOOTBALL_DATA_TOKEN = 'test-token'
    jest.spyOn(global, 'fetch').mockReset()
    mockClient.query.mockReset()
})

afterEach(() => {
    delete process.env.FOOTBALL_DATA_TOKEN
    jest.restoreAllMocks()
})

it('kaster hvis FOOTBALL_DATA_TOKEN mangler', async () => {
    delete process.env.FOOTBALL_DATA_TOKEN
    await expect(syncMatches(mockClient as any)).rejects.toThrow('Mangler FOOTBALL_DATA_TOKEN')
    expect(global.fetch).not.toHaveBeenCalled()
})

it('kaster ved ikke-ok respons fra football-data.org', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockErrResponse(429))
    await expect(syncMatches(mockClient as any)).rejects.toThrow('429')
})

it('returnerer hentet=0 og oppdatert=0 ved tom matches-array', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockOkResponse([]))
    const resultat = await syncMatches(mockClient as any)
    expect(resultat).toEqual({ hentet: 0, oppdatert: 0 })
    expect(mockClient.query).not.toHaveBeenCalled()
})

it('teller oppdaterte kamper basert på rowCount > 0', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockOkResponse([lagKamp({ id: 1 }), lagKamp({ id: 2 })]))
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 0 })

    const resultat = await syncMatches(mockClient as any)
    expect(resultat).toEqual({ hentet: 2, oppdatert: 1 })
})

it('sender riktig UPSERT-parametere for en gruppe-kamp', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockOkResponse([lagKamp({ id: 42 })]))
    mockClient.query.mockResolvedValue({ rowCount: 1 })

    await syncMatches(mockClient as any)

    const [sql, params] = mockClient.query.mock.calls[0]
    expect(sql).toContain('INSERT INTO matches')
    expect(params[0]).toBe(42) // match_num
    expect(params[1]).toBe(1) // round (GROUP_STAGE matchday 1)
    expect(params[2]).toBe('BRA') // home_team
    expect(params[3]).toBe('ARG') // away_team
    expect(params[4]).toBe('2026-06-15T12:00:00Z') // game_start
    expect(params[5]).toBe('Group A') // group
    expect(params[6]).toBe('GROUP_STAGE') // stage
    expect(params[7]).toBe('SCHEDULED') // status
})

it('sender riktig stage-verdi for sluttspill-kamper', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([lagKamp({ stage: 'QUARTER_FINALS', group: null, matchday: null })]),
    )
    mockClient.query.mockResolvedValue({ rowCount: 1 })

    await syncMatches(mockClient as any)

    const params = mockClient.query.mock.calls[0][1]
    expect(params[1]).toBe(6) // round
    expect(params[5]).toBeNull() // group
    expect(params[6]).toBe('QUARTER_FINALS') // stage
})

it('normaliserer URY til URU i insert-parametere', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockOkResponse([lagKamp({ homeTeam: { tla: 'URY' } })]))
    mockClient.query.mockResolvedValue({ rowCount: 0 })

    await syncMatches(mockClient as any)

    const params = mockClient.query.mock.calls[0][1]
    expect(params[2]).toBe('URU')
})

it('sender null for sluttspill-lag uten tla', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([lagKamp({ homeTeam: { tla: null }, awayTeam: { tla: null } })]),
    )
    mockClient.query.mockResolvedValue({ rowCount: 0 })

    await syncMatches(mockClient as any)

    const params = mockClient.query.mock.calls[0][1]
    expect(params[2]).toBeNull()
    expect(params[3]).toBeNull()
})
