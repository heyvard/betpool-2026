/**
 * @jest-environment node
 */
import { syncScores } from './syncScores'
import { FootballDataMatch } from '../data/footballDataMatch'

function lagKamp(overrides: Partial<FootballDataMatch> = {}): FootballDataMatch {
    return {
        id: 1,
        utcDate: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min siden
        status: 'FINISHED',
        stage: 'GROUP_STAGE',
        group: 'GROUP_A',
        matchday: 1,
        homeTeam: { tla: 'BRA' },
        awayTeam: { tla: 'ARG' },
        score: {
            winner: 'HOME_TEAM',
            duration: 'REGULAR',
            fullTime: { home: 2, away: 1 },
            halfTime: { home: 1, away: 0 },
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
        text: () => Promise.resolve('feil'),
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
    await expect(syncScores(mockClient as any)).rejects.toThrow('Mangler FOOTBALL_DATA_TOKEN')
    expect(global.fetch).not.toHaveBeenCalled()
})

it('kaster ved ikke-ok respons fra football-data.org', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockErrResponse(503))
    await expect(syncScores(mockClient as any)).rejects.toThrow('503')
})

it('inkluderer IN_PLAY-kamper uansett alder', async () => {
    const gammel = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([lagKamp({ id: 1, status: 'IN_PLAY', utcDate: gammel })]),
    )
    mockClient.query.mockResolvedValue({ rowCount: 0 })

    const resultat = await syncScores(mockClient as any)
    expect(resultat.hentet).toBe(1)
})

it('inkluderer PAUSED-kamper uansett alder', async () => {
    const gammel = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([lagKamp({ id: 1, status: 'PAUSED', utcDate: gammel })]),
    )
    mockClient.query.mockResolvedValue({ rowCount: 0 })

    const resultat = await syncScores(mockClient as any)
    expect(resultat.hentet).toBe(1)
})

it('inkluderer FINISHED-kamper innenfor 6 timer', async () => {
    const nylig = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([lagKamp({ id: 1, status: 'FINISHED', utcDate: nylig })]),
    )
    mockClient.query.mockResolvedValue({ rowCount: 1 })

    const resultat = await syncScores(mockClient as any)
    expect(resultat.hentet).toBe(1)
    expect(resultat.oppdatert).toBe(1)
})

it('ekskluderer FINISHED-kamper eldre enn 6 timer', async () => {
    const gammel = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString()
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([lagKamp({ id: 1, status: 'FINISHED', utcDate: gammel })]),
    )

    const resultat = await syncScores(mockClient as any)
    expect(resultat.hentet).toBe(0)
    expect(mockClient.query).not.toHaveBeenCalled()
})

it('inkluderer TIMED-kamper der kampstart har passert', async () => {
    const passert = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min siden
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([
            lagKamp({
                id: 1,
                status: 'TIMED',
                utcDate: passert,
                score: {
                    winner: null,
                    duration: 'REGULAR',
                    fullTime: { home: 1, away: 0 },
                    halfTime: { home: 0, away: 0 },
                    extraTime: null,
                    penalties: null,
                },
            }),
        ]),
    )
    mockClient.query.mockResolvedValue({ rowCount: 1 })

    const resultat = await syncScores(mockClient as any)
    expect(resultat.hentet).toBe(1)
})

it('inkluderer SCHEDULED-kamper der kampstart har passert', async () => {
    const passert = new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 min siden
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([
            lagKamp({
                id: 1,
                status: 'SCHEDULED',
                utcDate: passert,
                score: {
                    winner: null,
                    duration: 'REGULAR',
                    fullTime: { home: 0, away: 1 },
                    halfTime: { home: 0, away: 0 },
                    extraTime: null,
                    penalties: null,
                },
            }),
        ]),
    )
    mockClient.query.mockResolvedValue({ rowCount: 1 })

    const resultat = await syncScores(mockClient as any)
    expect(resultat.hentet).toBe(1)
})

it('ekskluderer TIMED-kamper der kampstart ikke har passert', async () => {
    const fremtidig = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min frem
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([lagKamp({ id: 1, status: 'TIMED', utcDate: fremtidig })]),
    )

    const resultat = await syncScores(mockClient as any)
    expect(resultat.hentet).toBe(0)
    expect(mockClient.query).not.toHaveBeenCalled()
})

it('hopper over kamper uten fullTime-score (null)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([
            lagKamp({
                score: {
                    winner: null,
                    duration: null,
                    fullTime: { home: null, away: null },
                    halfTime: { home: null, away: null },
                    extraTime: null,
                    penalties: null,
                },
            }),
        ]),
    )

    const resultat = await syncScores(mockClient as any)
    expect(resultat.hentet).toBe(1)
    expect(mockClient.query).not.toHaveBeenCalled()
})

it('teller oppdatert basert på rowCount', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockOkResponse([lagKamp({ id: 1 }), lagKamp({ id: 2 })]))
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 0 })

    const resultat = await syncScores(mockClient as any)
    expect(resultat).toEqual({ hentet: 2, oppdatert: 1 })
})

it('sender ekstraomgangs- og straffepark-score videre når de finnes', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([
            lagKamp({
                score: {
                    winner: 'AWAY_TEAM',
                    duration: 'PENALTY',
                    fullTime: { home: 1, away: 1 },
                    halfTime: { home: 0, away: 0 },
                    extraTime: { home: 0, away: 0 },
                    penalties: { home: 3, away: 5 },
                },
            }),
        ]),
    )
    mockClient.query.mockResolvedValue({ rowCount: 1 })

    await syncScores(mockClient as any)

    const params = mockClient.query.mock.calls[0][1]
    expect(params[1]).toBe(1) // synced_home_ft
    expect(params[2]).toBe(1) // synced_away_ft
    expect(params[3]).toBe(0) // synced_home_et
    expect(params[4]).toBe(0) // synced_away_et
    expect(params[5]).toBe(3) // synced_home_pen
    expect(params[6]).toBe(5) // synced_away_pen
    expect(params[7]).toBe('PENALTY') // synced_duration
})

it('sender null for ekstraomgang og straffer når det ikke finnes', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockOkResponse([lagKamp()]))
    mockClient.query.mockResolvedValue({ rowCount: 0 })

    await syncScores(mockClient as any)

    const params = mockClient.query.mock.calls[0][1]
    expect(params[3]).toBeNull() // synced_home_et
    expect(params[4]).toBeNull() // synced_away_et
    expect(params[5]).toBeNull() // synced_home_pen
    expect(params[6]).toBeNull() // synced_away_pen
})
