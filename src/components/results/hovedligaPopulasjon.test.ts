import { expect } from '@jest/globals'
import { calculateAllBetsExtended, filtrerAllBets } from './calculateAllBetsExtended'
import { calculateLeaderboard } from './calculateAllScores'
import { AllBets, MatchBet, OtherUser } from '../../queries/useAllBets'

// Speiler hvordan leaderboard-siden beregner poeng populasjonsspesifikt:
// hovedligaen kun fra hovedliga-medlemmer, en privat liga fra hovedliga-medlemmer
// pluss ligaens egne. En opt-ut-bruker skal ikke telle i hovedligaen.

function bet(user: string, home: string, away: string): MatchBet {
    return {
        user_id: user,
        match_num: 1,
        round: 1,
        game_start: '2026-06-01T00:00:00Z',
        home_team: 'Brasil',
        away_team: 'Argentina',
        home_score: home,
        away_score: away,
        home_result: '2',
        away_result: '1',
        joker: false,
    }
}

function bruker(id: string, iHovedliga: boolean, winner?: string): OtherUser {
    return { id, name: id, picture: null, paid: true, i_hovedliga: iHovedliga, winner }
}

function tavleFor(raw: AllBets, ids: Set<string>) {
    const ext = calculateAllBetsExtended(filtrerAllBets(raw, ids))
    return calculateLeaderboard(ext.bets, ext.users)
}

describe('Opt-ut fra hovedligaen påvirker poengberegningen', () => {
    // alice + carol er i hovedligaen, bob har valgt den bort. Alle tre tippet.
    const raw: AllBets = {
        users: [bruker('alice', true), bruker('carol', true), bruker('bob', false)],
        bets: [bet('alice', '2', '1'), bet('carol', '0', '0'), bet('bob', '2', '1')],
    }

    const hovedligaIds = new Set(raw.users.filter((u) => u.i_hovedliga !== false).map((u) => u.id))

    it('hovedliga-tavla utelater opt-ut-brukeren', () => {
        const tavle = tavleFor(raw, hovedligaIds)
        const navn = tavle.map((r) => r.userid)
        expect(navn).toContain('alice')
        expect(navn).toContain('carol')
        expect(navn).not.toContain('bob')
    })

    it('privat liga (hovedliga + ligaens medlemmer) tar med opt-ut-brukeren', () => {
        // Liga «Gutta» = alice + bob. Populasjon = hovedliga ∪ {alice, bob}.
        const populasjon = new Set(hovedligaIds)
        populasjon.add('alice')
        populasjon.add('bob')
        const tavle = tavleFor(raw, populasjon)
        const navn = tavle.map((r) => r.userid)
        expect(navn).toContain('alice')
        expect(navn).toContain('bob')
    })

    it('opt-ut-brukerens tips endrer ikke hovedligaens rariteter', () => {
        // I hovedligaen traff 1 av 2 (alice) det eksakte resultatet (50 %).
        // Tar vi med bob (også riktig) blir det 2 av 3 (67 %) — andelen, og dermed
        // poengverdien, ville endret seg hvis bob talte med. Vi sjekker at alices
        // poeng i hovedligaen er uavhengig av bob.
        const utenBob = tavleFor(raw, hovedligaIds).find((r) => r.userid === 'alice')!.poeng
        const medBob = tavleFor(raw, new Set([...hovedligaIds, 'bob'])).find((r) => r.userid === 'alice')!.poeng
        // Med færre som traff (lavere andel) er poengene minst like høye uten bob.
        expect(utenBob).toBeGreaterThanOrEqual(medBob)
        // Og hovedligaberegningen ser kun de to hovedliga-tippene.
        expect(filtrerAllBets(raw, hovedligaIds).bets).toHaveLength(2)
    })
})

describe('Vinnerbonus-nevneren er alltid hovedligaen, uansett hva allBets.users ellers inneholder', () => {
    // VM 2026-caset: 49 hovedliga-medlemmer der 10 tippet Spania, pluss 4 brukere
    // utenfor hovedligaen (typisk en privat ligas egne medlemmer, eller en enkelt
    // opt-ut-bruker lagt til på profil-/kampsiden slik at de kan se sine egne tips).
    // 10/49 = 20,4 % → 5 poeng. Regnes nevneren mot alle 53 blir det 18,9 % → 8.
    const hovedligaMedlemmer = [...Array(49)].map((_, i) => bruker(`h${i}`, true, i < 10 ? 'ESP' : 'FRA'))
    const utenfor = [...Array(4)].map((_, i) => bruker(`x${i}`, false, 'ESP'))
    const raw: AllBets = {
        users: [...hovedligaMedlemmer, ...utenfor],
        bets: [],
        tournamentResult: { winnerTeam: 'ESP', topscorerPlayerIds: [] },
    }

    it('calculateAllBetsExtended filtrerer selv til hovedligaen — også når callerens populasjon er bredere', () => {
        // Kalles her UFILTRERT, akkurat som en privat liga eller en enkeltbrukers
        // profilside gjør (populasjon = hovedliga + ekstra medlemmer). Funksjonen
        // skal selv se bort fra ekstra-medlemmene når bonus-nevneren regnes ut.
        const ext = calculateAllBetsExtended(raw)
        expect(ext.users).toHaveLength(53) // alle vises — filtrering gjelder kun nevneren
        expect(ext.users.find((u) => u.id === 'h0')!.winnerPoints).toEqual(5)
        expect(ext.users.find((u) => u.id === 'h10')!.winnerPoints).toEqual(0)
        // Ekstra-medlemmer som traff får samme (hovedliga-riktige) utbetaling —
        // bare selve nevneren er hovedliga-scoped, ikke hvem som kan vinne bonusen.
        expect(ext.users.find((u) => u.id === 'x0')!.winnerPoints).toEqual(5)
    })

    it('gir identisk resultat om calleren forhåndsfiltrerer med filtrerAllBets eller ikke', () => {
        const hovedligaIds = new Set(raw.users.filter((u) => u.i_hovedliga !== false).map((u) => u.id))
        const forhåndsfiltrert = calculateAllBetsExtended(filtrerAllBets(raw, hovedligaIds))
        const ufiltrert = calculateAllBetsExtended(raw)
        expect(forhåndsfiltrert.users.find((u) => u.id === 'h0')!.winnerPoints).toEqual(
            ufiltrert.users.find((u) => u.id === 'h0')!.winnerPoints,
        )
    })
})
