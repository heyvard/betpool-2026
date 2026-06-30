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
            regularTime: null,
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

it('inkluderer FINISHED-kamper eldre enn 6 timer som mangler synket score (catch-up)', async () => {
    const gammel = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString()
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([lagKamp({ id: 1, status: 'FINISHED', utcDate: gammel })]),
    )
    // DB har ingen synket score for kampen ennå
    mockClient.query.mockImplementation((sql: string) =>
        Promise.resolve(sql.trim().startsWith('SELECT') ? { rows: [] } : { rowCount: 1 }),
    )

    const resultat = await syncScores(mockClient as any)
    expect(resultat.hentet).toBe(1)
    expect(resultat.oppdatert).toBe(1)
})

it('ekskluderer FINISHED-kamper eldre enn 6 timer som allerede er synket', async () => {
    const gammel = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString()
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([lagKamp({ id: 1, status: 'FINISHED', utcDate: gammel })]),
    )
    // DB har allerede synket fulltidsresultat → ingen catch-up
    mockClient.query.mockImplementation((sql: string) =>
        Promise.resolve(
            sql.trim().startsWith('SELECT')
                ? { rows: [{ match_num: 1, synced_home_ft: 2, synced_away_ft: 1 }] }
                : { rowCount: 0 },
        ),
    )

    const resultat = await syncScores(mockClient as any)
    expect(resultat.hentet).toBe(0)
    // bare SELECT skal ha blitt kjørt, ingen INSERT
    expect(mockClient.query).toHaveBeenCalledTimes(1)
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
                    regularTime: null,
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
                    regularTime: null,
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
    mockClient.query.mockResolvedValue({ rows: [] })

    const resultat = await syncScores(mockClient as any)
    expect(resultat.hentet).toBe(0)
    // bare SELECT (DB-tilstand) kjøres, ingen INSERT
    expect(mockClient.query).toHaveBeenCalledTimes(1)
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
                    regularTime: null,
                    extraTime: null,
                    penalties: null,
                },
            }),
        ]),
    )
    mockClient.query.mockResolvedValue({ rows: [] })

    const resultat = await syncScores(mockClient as any)
    expect(resultat.hentet).toBe(1)
    // SELECT kjøres, men ingen INSERT siden fullTime mangler
    expect(mockClient.query).toHaveBeenCalledTimes(1)
})

it('teller oppdatert basert på rowCount', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockOkResponse([lagKamp({ id: 1 }), lagKamp({ id: 2 })]))
    mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SELECT (DB-tilstand)
        .mockResolvedValueOnce({ rowCount: 1 }) // INSERT kamp 1
        .mockResolvedValueOnce({ rowCount: 0 }) // INSERT kamp 2

    const resultat = await syncScores(mockClient as any)
    // Begge kampene er FINISHED (default-fixturen) → begge er ferdig-kandidater
    // for feed, uavhengig av om scoren faktisk endret seg (rowCount).
    expect(resultat).toEqual({ hentet: 2, oppdatert: 1, nyligFerdige: [1, 2] })
})

it('tar med en FERDIG (FINISHED) kamp som ferdig-kandidat', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockOkResponse([lagKamp({ id: 7 })])) // default FINISHED
    mockClient.query.mockImplementation((sql: string) =>
        Promise.resolve(sql.trim().startsWith('SELECT') ? { rows: [] } : { rowCount: 1 }),
    )

    const resultat = await syncScores(mockClient as any)
    expect(resultat.nyligFerdige).toEqual([7])
})

it('tar IKKE med en pågående (IN_PLAY) kamp selv om live-scoren synkes', async () => {
    const nylig = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([
            lagKamp({
                id: 7,
                status: 'IN_PLAY',
                utcDate: nylig,
                score: {
                    winner: null,
                    duration: 'REGULAR',
                    fullTime: { home: 1, away: 0 }, // live-score under spill
                    halfTime: { home: 0, away: 0 },
                    regularTime: null,
                    extraTime: null,
                    penalties: null,
                },
            }),
        ]),
    )
    mockClient.query.mockImplementation((sql: string) =>
        Promise.resolve(sql.trim().startsWith('SELECT') ? { rows: [] } : { rowCount: 1 }),
    )

    const resultat = await syncScores(mockClient as any)
    expect(resultat.oppdatert).toBe(1)
    expect(resultat.nyligFerdige).toEqual([]) // ikke ferdig → ingen feed-post
})

it('sender ordinær tid, ekstraomgangs- og straffepark-score videre når de finnes', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
        mockOkResponse([
            lagKamp({
                score: {
                    winner: 'AWAY_TEAM',
                    duration: 'PENALTY_SHOOTOUT',
                    // fullTime er totalen inkl. straffer; regularTime er 90-minutters-resultatet vi tipper på
                    fullTime: { home: 4, away: 6 },
                    halfTime: { home: 0, away: 1 },
                    regularTime: { home: 1, away: 1 },
                    extraTime: { home: 0, away: 0 },
                    penalties: { home: 3, away: 5 },
                },
            }),
        ]),
    )
    mockClient.query.mockResolvedValue({ rowCount: 1 })

    await syncScores(mockClient as any)

    // calls[0] er SELECT (DB-tilstand), calls[1] er INSERT-en
    const params = mockClient.query.mock.calls[1][1]
    expect(params[1]).toBe(4) // synced_home_ft (totalen)
    expect(params[2]).toBe(6) // synced_away_ft (totalen)
    expect(params[3]).toBe(1) // synced_home_rt (ordinær tid)
    expect(params[4]).toBe(1) // synced_away_rt (ordinær tid)
    expect(params[5]).toBe(0) // synced_home_et
    expect(params[6]).toBe(0) // synced_away_et
    expect(params[7]).toBe(3) // synced_home_pen
    expect(params[8]).toBe(5) // synced_away_pen
    expect(params[9]).toBe('PENALTY_SHOOTOUT') // synced_duration
    expect(params[10]).toBe('AWAY_TEAM') // synced_winner
})

it('sender null for ordinær tid, ekstraomgang og straffer når det ikke finnes', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockOkResponse([lagKamp()]))
    mockClient.query.mockResolvedValue({ rowCount: 0 })

    await syncScores(mockClient as any)

    // calls[0] er SELECT (DB-tilstand), calls[1] er INSERT-en
    const params = mockClient.query.mock.calls[1][1]
    expect(params[3]).toBeNull() // synced_home_rt
    expect(params[4]).toBeNull() // synced_away_rt
    expect(params[5]).toBeNull() // synced_home_et
    expect(params[6]).toBeNull() // synced_away_et
    expect(params[7]).toBeNull() // synced_home_pen
    expect(params[8]).toBeNull() // synced_away_pen
})
