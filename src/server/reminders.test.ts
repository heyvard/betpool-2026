/**
 * @jest-environment node
 */
import { sendPåminnelser } from './reminders'
import { hentKamper } from '../data/matches'
import { sendPushTilBruker } from './push'
import { Match } from '../types/types'

jest.mock('../data/matches')
jest.mock('./push')

const hentKamperMock = hentKamper as jest.Mock
const sendPushMock = sendPushTilBruker as jest.Mock

// Fastsatt "nå": 2026-06-09T12:00:00Z (Oslo = 14:00 CEST).
// Kampdag-vindu for i morgen: 2026-06-10T10:00:00Z → 2026-06-11T10:00:00Z.
const FASTSATT_NÅ = new Date('2026-06-09T12:00:00Z')
const KAMP_I_MORGEN = '2026-06-10T14:00:00Z' // innenfor kampdag-vinduet
const KAMP_I_DAG = '2026-06-09T14:00:00Z' // utenfor vinduet
const KAMP_OVERMORGEN = '2026-06-11T14:00:00Z' // utenfor vinduet

function lagMatch(matchNum: number, gameStart: string): Match {
    return {
        match_num: matchNum,
        round: 1,
        home_team: 'BRA',
        away_team: 'ARG',
        game_start: gameStart,
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
    }
}

const mockClient = { query: jest.fn() }

beforeAll(() => {
    jest.useFakeTimers()
    jest.setSystemTime(FASTSATT_NÅ)
})

afterAll(() => {
    jest.useRealTimers()
})

beforeEach(() => {
    jest.clearAllMocks()
    mockClient.query.mockReset()
})

it('returnerer tidlig når det ikke er kamper i morgen', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(1, KAMP_I_DAG), lagMatch(2, KAMP_OVERMORGEN)])

    const resultat = await sendPåminnelser(mockClient as any)

    expect(resultat).toEqual({ kamperIMorgen: 0, brukereVarslet: 0 })
    expect(mockClient.query).not.toHaveBeenCalled()
    expect(sendPushMock).not.toHaveBeenCalled()
})

it('returnerer brukereVarslet=0 når ingen aktive brukere har påminnelser på', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN)])
    mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // ingen brukere med notif_reminders=true
        .mockResolvedValueOnce({ rows: [] }) // bets (kalles ikke, men defensivt satt opp)

    const resultat = await sendPåminnelser(mockClient as any)

    expect(resultat.kamperIMorgen).toBe(1)
    expect(resultat.brukereVarslet).toBe(0)
    expect(sendPushMock).not.toHaveBeenCalled()
})

it('hopper over bruker som allerede har tippet alle morgendagens kamper', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN)])
    mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-1' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'bruker-1', match_num: 100 }] })

    const resultat = await sendPåminnelser(mockClient as any)

    expect(resultat.kamperIMorgen).toBe(1)
    expect(resultat.brukereVarslet).toBe(0)
    expect(sendPushMock).not.toHaveBeenCalled()
})

it('varsler bruker som har utippede kamper i morgen', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN), lagMatch(101, KAMP_I_MORGEN)])
    sendPushMock.mockResolvedValue(1)
    mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-1' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'bruker-1', match_num: 100 }] }) // tippet én av to

    const resultat = await sendPåminnelser(mockClient as any)

    expect(resultat.kamperIMorgen).toBe(2)
    expect(resultat.brukereVarslet).toBe(1)
    expect(sendPushMock).toHaveBeenCalledWith(
        mockClient,
        'bruker-1',
        expect.objectContaining({ title: 'Husk å tippe! ⚽️' }),
    )
})

it('varsler flere brukere uavhengig av hverandre', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN)])
    sendPushMock.mockResolvedValue(1)
    mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-1' }, { id: 'bruker-2' }] })
        .mockResolvedValueOnce({ rows: [] }) // ingen har tippet

    const resultat = await sendPåminnelser(mockClient as any)

    expect(resultat.brukereVarslet).toBe(2)
    expect(sendPushMock).toHaveBeenCalledTimes(2)
})

it('bruker entallsform i push-melding for én utippet kamp', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN)])
    sendPushMock.mockResolvedValue(1)
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'bruker-1' }] }).mockResolvedValueOnce({ rows: [] })

    await sendPåminnelser(mockClient as any)

    const payload = sendPushMock.mock.calls[0][2]
    expect(payload.body).toContain('1 kamp')
    expect(payload.body).not.toContain('kamper')
})

it('bruker flertallsform i push-melding for flere utippede kamper', async () => {
    hentKamperMock.mockResolvedValue([
        lagMatch(100, KAMP_I_MORGEN),
        lagMatch(101, KAMP_I_MORGEN),
        lagMatch(102, KAMP_I_MORGEN),
    ])
    sendPushMock.mockResolvedValue(1)
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'bruker-1' }] }).mockResolvedValueOnce({ rows: [] })

    await sendPåminnelser(mockClient as any)

    const payload = sendPushMock.mock.calls[0][2]
    expect(payload.body).toContain('3 kamper')
})

it('teller ikke bruker som varslet hvis sendPush returnerer 0 (ingen abonnement)', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN)])
    sendPushMock.mockResolvedValue(0)
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'bruker-1' }] }).mockResolvedValueOnce({ rows: [] })

    const resultat = await sendPåminnelser(mockClient as any)

    expect(resultat.brukereVarslet).toBe(0)
})

it('sender riktig url i push-payload', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN)])
    sendPushMock.mockResolvedValue(1)
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'bruker-1' }] }).mockResolvedValueOnce({ rows: [] })

    await sendPåminnelser(mockClient as any)

    const payload = sendPushMock.mock.calls[0][2]
    expect(payload.url).toBe('/my-bets')
})
