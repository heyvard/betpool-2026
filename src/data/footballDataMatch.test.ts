import { FootballDataMatch, normaliserTla, normaliserStatus, stageTilRunde, transformerKamp } from './footballDataMatch'

const baseKamp: FootballDataMatch = {
    id: 123,
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
}

describe('normaliserTla', () => {
    it('returnerer tom streng for null', () => {
        expect(normaliserTla(null)).toBe('')
    })

    it('normaliserer URY til URU', () => {
        expect(normaliserTla('URY')).toBe('URU')
    })

    it('videresender andre TLA-koder uendret', () => {
        expect(normaliserTla('BRA')).toBe('BRA')
        expect(normaliserTla('NOR')).toBe('NOR')
        expect(normaliserTla('ESP')).toBe('ESP')
    })
})

describe('normaliserStatus', () => {
    it('videresender kjente statuser uendret', () => {
        const kjente = [
            'SCHEDULED',
            'TIMED',
            'IN_PLAY',
            'PAUSED',
            'FINISHED',
            'SUSPENDED',
            'POSTPONED',
            'CANCELLED',
            'AWARDED',
        ]
        kjente.forEach((s) => expect(normaliserStatus(s)).toBe(s))
    })

    it('faller tilbake til TIMED for ukjente statuser', () => {
        expect(normaliserStatus('UKJENT')).toBe('TIMED')
        expect(normaliserStatus('NY_STATUS_FRA_API')).toBe('TIMED')
    })

    it('faller tilbake til TIMED for null', () => {
        expect(normaliserStatus(null)).toBe('TIMED')
    })
})

describe('stageTilRunde', () => {
    it('mapper GROUP_STAGE til matchday', () => {
        expect(stageTilRunde('GROUP_STAGE', 1)).toBe(1)
        expect(stageTilRunde('GROUP_STAGE', 2)).toBe(2)
        expect(stageTilRunde('GROUP_STAGE', 3)).toBe(3)
    })

    it('bruker 1 for GROUP_STAGE uten matchday', () => {
        expect(stageTilRunde('GROUP_STAGE', null)).toBe(1)
    })

    it('mapper sluttspill-runder korrekt', () => {
        expect(stageTilRunde('LAST_32', null)).toBe(4)
        expect(stageTilRunde('LAST_16', null)).toBe(5)
        expect(stageTilRunde('QUARTER_FINALS', null)).toBe(6)
        expect(stageTilRunde('SEMI_FINALS', null)).toBe(7)
        expect(stageTilRunde('THIRD_PLACE', null)).toBe(8)
        expect(stageTilRunde('FINAL', null)).toBe(9)
    })

    it('faller tilbake til 1 for ukjent stage', () => {
        expect(stageTilRunde('UKJENT_STAGE', null)).toBe(1)
    })
})

describe('transformerKamp', () => {
    it('transformerer en gruppe-kamp riktig', () => {
        const kamp = transformerKamp(baseKamp)
        expect(kamp).toMatchObject({
            match_num: 123,
            round: 1,
            home_team: 'BRA',
            away_team: 'ARG',
            game_start: '2026-06-15T12:00:00Z',
            group: 'Group A',
            status: 'SCHEDULED',
            home_score: null,
            away_score: null,
        })
    })

    it('normaliserer URY til URU under transformering', () => {
        const kamp = transformerKamp({ ...baseKamp, homeTeam: { tla: 'URY' } })
        expect(kamp.home_team).toBe('URU')
    })

    it('håndterer sluttspill-lag uten tla (null → tom streng)', () => {
        const kamp = transformerKamp({
            ...baseKamp,
            stage: 'FINAL',
            group: null,
            matchday: null,
            homeTeam: { tla: null },
            awayTeam: { tla: null },
        })
        expect(kamp.home_team).toBe('')
        expect(kamp.away_team).toBe('')
        expect(kamp.group).toBeUndefined()
        expect(kamp.round).toBe(9)
    })

    it('mapper GROUP_B til Group B', () => {
        const kamp = transformerKamp({ ...baseKamp, group: 'GROUP_B' })
        expect(kamp.group).toBe('Group B')
    })

    it('setter ukjent status til TIMED', () => {
        const kamp = transformerKamp({ ...baseKamp, status: 'UKJENT_STATUS' })
        expect(kamp.status).toBe('TIMED')
    })
})
