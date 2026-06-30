import { resolveActiveScore, AktivScoreRad } from './matchScore'

function rad(overrides: Partial<AktivScoreRad> = {}): AktivScoreRad {
    return {
        home_score: null,
        away_score: null,
        synced_home_rt: null,
        synced_away_rt: null,
        synced_home_ft: null,
        synced_away_ft: null,
        use_manual: false,
        ...overrides,
    }
}

describe('resolveActiveScore', () => {
    it('bruker fulltid når det ikke finnes ordinær tid (kamp avgjort innen 90 min)', () => {
        expect(resolveActiveScore(rad({ synced_home_ft: 2, synced_away_ft: 1 }))).toEqual({
            home_score: 2,
            away_score: 1,
        })
    })

    it('foretrekker ordinær tid over fulltid i sluttspillkamper (straffer teller ikke)', () => {
        // football-data: fullTime er totalen inkl. straffer (4–5), regularTime er 1–1
        const score = rad({
            synced_home_ft: 4,
            synced_away_ft: 5,
            synced_home_rt: 1,
            synced_away_rt: 1,
        })
        expect(resolveActiveScore(score)).toEqual({ home_score: 1, away_score: 1 })
    })

    it('foretrekker ordinær tid også når kampen ble avgjort i ekstraomganger', () => {
        // 1–1 etter ordinær tid, hjemmelaget vant 2–1 i ekstraomganger (fullTime 2–1)
        const score = rad({
            synced_home_ft: 2,
            synced_away_ft: 1,
            synced_home_rt: 1,
            synced_away_rt: 1,
        })
        expect(resolveActiveScore(score)).toEqual({ home_score: 1, away_score: 1 })
    })

    it('bruker manuell score når use_manual er satt, uavhengig av synket ordinær tid', () => {
        const score = rad({
            use_manual: true,
            home_score: 3,
            away_score: 0,
            synced_home_rt: 1,
            synced_away_rt: 1,
            synced_home_ft: 4,
            synced_away_ft: 5,
        })
        expect(resolveActiveScore(score)).toEqual({ home_score: 3, away_score: 0 })
    })

    it('faller tilbake til manuell når ingen synket score finnes', () => {
        expect(resolveActiveScore(rad({ home_score: 2, away_score: 2 }))).toEqual({
            home_score: 2,
            away_score: 2,
        })
    })
})
