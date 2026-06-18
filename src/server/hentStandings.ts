import { gruppeTilTekst, normaliserTla } from '../data/footballDataMatch'
import { GroupStanding, StandingRow } from '../types/types'

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'

// Kort in-memory-cache så gruppetabellene ikke hentes på nytt for hver sidelast.
// football-data free tier tillater bare 10 kall/min; modul-scope overlever
// mellom invokasjoner i en varm serverless-instans (pool er max: 1).
const CACHE_TTL_MS = 60_000

// Rå standings slik football-data.org v4 leverer dem (feltene vi bruker).
interface FootballDataTableRow {
    position: number
    team: { tla: string | null }
    playedGames: number
    won: number
    draw: number
    lost: number
    goalsFor: number
    goalsAgainst: number
    goalDifference: number
    points: number
}

interface FootballDataStanding {
    stage: string
    type: string // TOTAL | HOME | AWAY
    group: string | null // "GROUP_A"
    table: FootballDataTableRow[]
}

interface FootballDataStandingsResponse {
    standings: FootballDataStanding[]
}

let cache: { data: GroupStanding[]; hentet: number } | null = null

// Henter gruppetabellene rett fra football-data.org og transformerer til
// GroupStanding[]. Bruker kun `type === 'TOTAL'` (samlet tabell, ikke
// hjemme/borte). Endepunktet kan returnere tomme tabeller før første kamp.
export async function hentStandings(): Promise<GroupStanding[]> {
    if (cache && Date.now() - cache.hentet < CACHE_TTL_MS) {
        return cache.data
    }

    const token = process.env.FOOTBALL_DATA_TOKEN
    if (!token) {
        throw new Error('Mangler FOOTBALL_DATA_TOKEN')
    }

    // NB: IKKE send ?season=… her. Med season-parameter svarer football-data med
    // én samlet GROUP_STAGE-tabell (group: null) i stedet for én tabell per
    // gruppe — da blir gruppene borte. Uten parameteren defaulter den til
    // gjeldende sesong og gir per-gruppe-tabellene (type TOTAL, group "Group A").
    const url = `${BASE_URL}/competitions/${COMPETITION}/standings`
    const res = await fetch(url, { headers: { 'X-Auth-Token': token } })
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`football-data.org svarte ${res.status} ${res.statusText}: ${body}`)
    }

    const body = (await res.json()) as FootballDataStandingsResponse
    const grupper = (body.standings ?? []).filter((s) => s.type === 'TOTAL' && s.group)

    const resultat: GroupStanding[] = []
    for (const gruppe of grupper) {
        const group = gruppeTilTekst(gruppe.group)
        if (!group) continue
        const table: StandingRow[] = []
        for (const rad of gruppe.table) {
            const tla = normaliserTla(rad.team?.tla ?? null)
            if (!tla) continue
            table.push({
                team_tla: tla,
                position: rad.position,
                played: rad.playedGames,
                won: rad.won,
                draw: rad.draw,
                lost: rad.lost,
                goals_for: rad.goalsFor,
                goals_against: rad.goalsAgainst,
                goal_difference: rad.goalDifference,
                points: rad.points,
            })
        }
        resultat.push({ group, table })
    }

    cache = { data: resultat, hentet: Date.now() }
    return resultat
}
