/**
 * @jest-environment node
 */
import { sendPåminnelser, sendEttermiddagsVarsler } from './reminders'
import { hentKamper } from '../data/matches'
import { sendPushTilBruker } from './push'
import { Match } from '../types/types'

jest.mock('../data/matches')
jest.mock('./push')

const hentKamperMock = hentKamper as jest.Mock
const sendPushMock = sendPushTilBruker as jest.Mock

// Fastsatt "nå": 2026-06-09T12:00:00Z (Oslo = 14:00 CEST).
// 24-timersvindu for påminnelser: 2026-06-09T12:00:00Z → 2026-06-10T12:00:00Z.
const FASTSATT_NÅ = new Date('2026-06-09T12:00:00Z')
const KAMP_I_MORGEN = '2026-06-10T10:00:00Z' // 22 t frem, innenfor 24-timersvinduet
const KAMP_ALLEREDE_STARTET = '2026-06-09T10:00:00Z' // 2 t siden, utenfor vinduet
const KAMP_ETTER_24T = '2026-06-10T14:00:00Z' // 26 t frem, utenfor vinduet (jf. bugg-rapport)

// For ettermiddagsvarsel: kamp som ikke har startet ennå i dag
// Nå er 2026-06-09T12:00:00Z (Oslo 14:00)
// Kampdag-vindu i dag: 10:00 UTC → neste dag 10:00 UTC (12:00 Oslo → 12:00 Oslo)
const KAMP_I_DAG_STARTET = '2026-06-09T10:30:00Z' // 12:30 Oslo, allerede startet (< nå 12:00 UTC)
const KAMP_I_DAG_FREMTIDIG = '2026-06-09T14:30:00Z' // 16:30 Oslo, etter nå (> nå 12:00 UTC)

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

// --- sendPåminnelser ---

it('returnerer tidlig når det ikke er kamper innen 24 timer', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(1, KAMP_ALLEREDE_STARTET), lagMatch(2, KAMP_ETTER_24T)])

    const resultat = await sendPåminnelser(mockClient as any)

    expect(resultat).toEqual({ kamperIMorgen: 0, brukereVarslet: 0 })
    expect(mockClient.query).not.toHaveBeenCalled()
    expect(sendPushMock).not.toHaveBeenCalled()
})

it('varsler ikke om natt-kamp som starter mer enn 24 timer frem (jf. bugg-rapport)', async () => {
    // En kamp 26 t frem (f.eks. 04:00 to netter senere) skal ikke utløse varsel,
    // selv om den faller på neste kalenderdøgn.
    hentKamperMock.mockResolvedValue([lagMatch(300, KAMP_ETTER_24T)])

    const resultat = await sendPåminnelser(mockClient as any)

    expect(resultat).toEqual({ kamperIMorgen: 0, brukereVarslet: 0 })
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
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-1', language: 'no' }] })
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
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-1', language: 'no' }] })
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
        .mockResolvedValueOnce({
            rows: [
                { id: 'bruker-1', language: 'no' },
                { id: 'bruker-2', language: 'no' },
            ],
        })
        .mockResolvedValueOnce({ rows: [] }) // ingen har tippet

    const resultat = await sendPåminnelser(mockClient as any)

    expect(resultat.brukereVarslet).toBe(2)
    expect(sendPushMock).toHaveBeenCalledTimes(2)
})

it('bruker entallsform i push-melding for én utippet kamp', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN)])
    sendPushMock.mockResolvedValue(1)
    mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-1', language: 'no' }] })
        .mockResolvedValueOnce({ rows: [] })

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
    mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-1', language: 'no' }] })
        .mockResolvedValueOnce({ rows: [] })

    await sendPåminnelser(mockClient as any)

    const payload = sendPushMock.mock.calls[0][2]
    expect(payload.body).toContain('3 kamper')
})

it('teller ikke bruker som varslet hvis sendPush returnerer 0 (ingen abonnement)', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN)])
    sendPushMock.mockResolvedValue(0)
    mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-1', language: 'no' }] })
        .mockResolvedValueOnce({ rows: [] })

    const resultat = await sendPåminnelser(mockClient as any)

    expect(resultat.brukereVarslet).toBe(0)
})

it('sender riktig url i push-payload', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN)])
    sendPushMock.mockResolvedValue(1)
    mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-1', language: 'no' }] })
        .mockResolvedValueOnce({ rows: [] })

    await sendPåminnelser(mockClient as any)

    const payload = sendPushMock.mock.calls[0][2]
    expect(payload.url).toBe('/my-bets')
})

it('sender fransk tekst til franske brukere', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN)])
    sendPushMock.mockResolvedValue(1)
    mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-fr', language: 'fr' }] })
        .mockResolvedValueOnce({ rows: [] })

    await sendPåminnelser(mockClient as any)

    const payload = sendPushMock.mock.calls[0][2]
    expect(payload.title).toContain('parier')
    expect(payload.body).toContain('match')
})

it('sender norsk tekst til norske brukere', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN)])
    sendPushMock.mockResolvedValue(1)
    mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-no', language: 'no' }] })
        .mockResolvedValueOnce({ rows: [] })

    await sendPåminnelser(mockClient as any)

    const payload = sendPushMock.mock.calls[0][2]
    expect(payload.title).toContain('tippe')
    expect(payload.body).toContain('morgen')
})

it('sender riktig tekst til blanding av norske og franske brukere', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(100, KAMP_I_MORGEN)])
    sendPushMock.mockResolvedValue(1)
    mockClient.query
        .mockResolvedValueOnce({
            rows: [
                { id: 'bruker-no', language: 'no' },
                { id: 'bruker-fr', language: 'fr' },
            ],
        })
        .mockResolvedValueOnce({ rows: [] })

    await sendPåminnelser(mockClient as any)

    expect(sendPushMock).toHaveBeenCalledTimes(2)
    const payloadNo = sendPushMock.mock.calls[0][2]
    const payloadFr = sendPushMock.mock.calls[1][2]
    expect(payloadNo.title).toContain('tippe')
    expect(payloadFr.title).toContain('parier')
})

// --- sendEttermiddagsVarsler ---

it('returnerer tidlig når det ikke er gjenværende kamper i dag', async () => {
    // Kun kamper som allerede har startet eller ikke er i dag
    hentKamperMock.mockResolvedValue([
        lagMatch(1, KAMP_I_DAG_STARTET), // allerede startet
        lagMatch(2, KAMP_I_MORGEN), // i morgen (utenfor daglig vindu)
    ])

    const resultat = await sendEttermiddagsVarsler(mockClient as any)

    expect(resultat).toEqual({ kamperIKveldOgNatt: 0, brukereVarslet: 0 })
    expect(mockClient.query).not.toHaveBeenCalled()
    expect(sendPushMock).not.toHaveBeenCalled()
})

it('varsler bruker med utippet kamp i kveld (norsk)', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(200, KAMP_I_DAG_FREMTIDIG)])
    sendPushMock.mockResolvedValue(1)
    mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-1', language: 'no' }] })
        .mockResolvedValueOnce({ rows: [] })

    const resultat = await sendEttermiddagsVarsler(mockClient as any)

    expect(resultat.kamperIKveldOgNatt).toBe(1)
    expect(resultat.brukereVarslet).toBe(1)
    const payload = sendPushMock.mock.calls[0][2]
    expect(payload.title).toContain('tippe')
    expect(payload.body).toContain('kveld')
    expect(payload.url).toBe('/my-bets')
})

it('varsler bruker med utippet kamp i kveld (fransk)', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(200, KAMP_I_DAG_FREMTIDIG)])
    sendPushMock.mockResolvedValue(1)
    mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-fr', language: 'fr' }] })
        .mockResolvedValueOnce({ rows: [] })

    await sendEttermiddagsVarsler(mockClient as any)

    const payload = sendPushMock.mock.calls[0][2]
    expect(payload.title).toContain('parier')
    expect(payload.body).toContain('soir')
})

it('hopper over bruker som har tippet alle kveldskampene', async () => {
    hentKamperMock.mockResolvedValue([lagMatch(200, KAMP_I_DAG_FREMTIDIG)])
    mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'bruker-1', language: 'no' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'bruker-1', match_num: 200 }] })

    const resultat = await sendEttermiddagsVarsler(mockClient as any)

    expect(resultat.brukereVarslet).toBe(0)
    expect(sendPushMock).not.toHaveBeenCalled()
})
