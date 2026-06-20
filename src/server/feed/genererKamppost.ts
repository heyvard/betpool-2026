import { PoolClient } from 'pg'

import { HovedligaData, hentHovedligaData, sorterTabell } from './hovedligaData'
import {
    FeedAccent,
    formatLuke,
    formatResultat,
    formatTipp,
    malIngenTraff,
    malLederBest,
    malLederBommet,
    malSjeldent,
} from './maler'
import { resolveActiveScore } from '../../data/matchScore'
import { rundeTilTekst } from '../../utils/rundeTilTekst'

// Rundevekt — samme trapp som matchScoreCalculator (gruppespill ×1 → finale ×4).
// Kun lesing/visning; selve poengene regnes uendret av scoring-laget.
function finnVekting(round: number): number {
    switch (round) {
        case 4:
        case 5:
            return 2
        case 6:
        case 7:
        case 8:
            return 3
        case 9:
            return 4
        default:
            return 1
    }
}

export interface FerdigKampRow {
    match_num: number
    round: number
    home_team: string | null
    away_team: string | null
    home_score: number | null
    away_score: number | null
    home_team_override: string | null
    away_team_override: string | null
    synced_home_ft: number | null
    synced_away_ft: number | null
    use_manual: boolean
}

export interface Kamppost {
    scenario: string
    accent: FeedAccent
    tittel: string
    body: string
    data: Record<string, unknown>
}

// Finner kamper som er ferdige (begge fulltidsfeltene satt) og som ennå ikke har
// en feed-post — håndterer både «akkurat ferdig denne synken» og catch-up etter
// en bom-synk, og er idempotent.
async function hentFerdigeUtenPost(client: PoolClient): Promise<FerdigKampRow[]> {
    const res = await client.query<FerdigKampRow>(`
        SELECT m.match_num, m.round, m.home_team, m.away_team,
               ms.home_score, ms.away_score,
               ms.home_team_override, ms.away_team_override,
               ms.synced_home_ft, ms.synced_away_ft, ms.use_manual
        FROM matches m
        JOIN match_scores ms ON ms.match_num = m.match_num
        WHERE ms.synced_home_ft IS NOT NULL
          AND ms.synced_away_ft IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM feed_posts fp
              WHERE fp.kind = 'kamp' AND fp.match_num = m.match_num
          )`)
    return res.rows
}

// Bygger én kamp-post (scenario + ferdig flettet tekst + data) ut fra hovedligaens
// stilling slik `hd` representerer den. `hd` kan være beregnet «nå» (live-synk)
// eller som-av kampens sluttidspunkt (backfill) — scenariovalget er likt.
// Returnerer null hvis kampen ikke har hovedliga-tips eller mangler resultat.
export function lagKamppost(kamp: FerdigKampRow, hd: HovedligaData): Kamppost | null {
    const { extended, leaderboard, scoreForKamp, allBets } = hd
    const mp = scoreForKamp.get(String(kamp.match_num))
    if (!mp) return null

    const resultat = resolveActiveScore(kamp)
    if (resultat.home_score === null || resultat.away_score === null) return null

    const tabell = sorterTabell(leaderboard)
    const leder = tabell[0] ?? null
    const navnMap = new Map(allBets.users.map((u) => [u.id, u.name]))
    const totalMap = new Map(leaderboard.map((r) => [r.userid, r.poeng]))

    const homeTla = kamp.home_team_override ?? kamp.home_team ?? ''
    const awayTla = kamp.away_team_override ?? kamp.away_team ?? ''
    const resultatStr = formatResultat(resultat.home_score, resultat.away_score)

    const betsForKamp = allBets.bets.filter((b) => b.match_num === kamp.match_num)
    const extForKamp = extended.bets.filter((b) => b.match_num === kamp.match_num)
    const poengPerBruker = new Map(extForKamp.map((b) => [b.user_id, b.poeng]))
    const totalt = betsForKamp.length
    const maxPoeng = extForKamp.reduce((m, b) => Math.max(m, b.poeng), 0)
    const topScorere = extForKamp.filter((b) => b.poeng === maxPoeng && maxPoeng > 0).map((b) => b.user_id)
    const eksaktBrukere = extForKamp.filter((b) => b.riktigResultat).map((b) => b.user_id)
    const vekt = finnVekting(kamp.round)
    const lederPoengHer = leder ? (poengPerBruker.get(leder.userid) ?? 0) : 0
    const lederHarTips = leder ? betsForKamp.some((b) => b.user_id === leder.userid) : false

    let mal: { accent: FeedAccent; tittel: string; body: string } | null = null
    let scenario = ''
    const data: Record<string, unknown> = {
        homeTeam: homeTla,
        awayTeam: awayTla,
        homeScore: resultat.home_score,
        awayScore: resultat.away_score,
        resultat: resultatStr,
        round: kamp.round,
        rundeTekst: rundeTilTekst(kamp.round),
    }

    // Prioritert scenariovalg (første som treffer vinner).
    if (mp.antallRiktigeSvar >= 1 && (mp.andelRiktigeResultat < 0.15 || mp.antallRiktigeSvar === 1)) {
        // 1. sjeldent
        scenario = 'sjeldent'
        const spillere = eksaktBrukere.map((id) => navnMap.get(id) ?? 'ukjent')
        const poengForTreff = eksaktBrukere.reduce((m, id) => Math.max(m, poengPerBruker.get(id) ?? 0), 0)
        const erEnesteToppscorer =
            mp.antallRiktigeSvar === 1 && topScorere.length === 1 && topScorere[0] === eksaktBrukere[0]
        const superlativ = erEnesteToppscorer ? 'kveldens største napp' : undefined
        mal = malSjeldent({
            spillere,
            resultat: resultatStr,
            antall: mp.antallRiktigeSvar,
            totalt,
            vekt,
            poeng: poengForTreff,
            superlativ,
        })
        Object.assign(data, { spillere, antall: mp.antallRiktigeSvar, totalt, vekt, poeng: poengForTreff })
    } else if (leder && lederHarTips && lederPoengHer === 0 && maxPoeng > 0) {
        // 2. leder_bommet
        scenario = 'leder_bommet'
        const lederBet = betsForKamp.find((b) => b.user_id === leder.userid)!
        const ledersTipp = formatTipp(Number(lederBet.home_score), Number(lederBet.away_score), homeTla, awayTla)
        const utfordrerId = topScorere[0]
        const utfordrer = navnMap.get(utfordrerId) ?? 'ukjent'
        const luke = Math.max(0, leder.poeng - (totalMap.get(utfordrerId) ?? 0))
        mal = malLederBommet({
            leder: leder.userName,
            ledersTipp,
            utfordrer,
            poeng: maxPoeng,
            luke: formatLuke(luke),
        })
        Object.assign(data, { leder: leder.userName, ledersTipp, utfordrer, poeng: maxPoeng, luke })
    } else if (leder && maxPoeng > 0 && topScorere.includes(leder.userid)) {
        // 3. leder_best
        scenario = 'leder_best'
        mal = malLederBest({
            navn: leder.userName,
            poeng: maxPoeng,
            resultat: resultatStr,
            sum: leder.poeng,
            antallRiktige: mp.antallRiktigeSvar,
            totalt,
            erLeder: true,
        })
        Object.assign(data, { navn: leder.userName, poeng: maxPoeng, sum: leder.poeng })
    } else if (mp.antallRiktigeSvar === 0) {
        // 4. ingen_traff
        scenario = 'ingen_traff'
        mal = malIngenTraff({
            totalt,
            resultat: resultatStr,
            utfall: mp.utfall,
            homeTla,
            awayTla,
            antallUtfall: mp.antallRiktigeUtfall,
        })
        Object.assign(data, { totalt, utfall: mp.utfall, antallUtfall: mp.antallRiktigeUtfall })
    } else if (maxPoeng > 0) {
        // 5. fallback leder_best — den med høyest poengsum i kampen.
        scenario = 'leder_best'
        const toppId = topScorere[0]
        const navn = navnMap.get(toppId) ?? 'ukjent'
        const erLeder = leder?.userid === toppId
        mal = malLederBest({
            navn,
            poeng: maxPoeng,
            resultat: resultatStr,
            sum: totalMap.get(toppId) ?? 0,
            antallRiktige: mp.antallRiktigeSvar,
            totalt,
            erLeder,
        })
        Object.assign(data, { navn, poeng: maxPoeng, sum: totalMap.get(toppId) ?? 0 })
    }

    if (!mal) return null
    data.scenario = scenario
    return { scenario, accent: mal.accent, tittel: mal.tittel, body: mal.body, data }
}

// Inserter en kamp-post. `createdAt` settes for backfill (historisk tidspunkt);
// utelatt for live-synk (default now()). Idempotent via UNIQUE-en. Returnerer
// true hvis en rad faktisk ble lagt til.
export async function insertKamppost(
    client: PoolClient,
    matchNum: number,
    post: Kamppost,
    createdAt?: Date,
): Promise<boolean> {
    const insert = await client.query(
        `INSERT INTO feed_posts (kind, scenario, match_num, accent, tittel, body, data, created_at)
         VALUES ('kamp', $1, $2, $3, $4, $5, $6, COALESCE($7, now()))
         ON CONFLICT (kind, scenario, match_num) DO NOTHING`,
        [
            post.scenario,
            matchNum,
            post.accent,
            post.tittel,
            post.body,
            JSON.stringify(post.data),
            createdAt ? createdAt.toISOString() : null,
        ],
    )
    return !!(insert.rowCount && insert.rowCount > 0)
}

export interface KampPostResultat {
    behandlet: number
    postet: number
}

// Genererer kamp-oppsummeringer for hovedligaen (Æresligaen). Kalles fra
// score-synk-flyten etter at scores er upsertet. Trygt å kjøre på nytt.
export async function genererKampposter(client: PoolClient, now: Date = new Date()): Promise<KampPostResultat> {
    const ferdige = await hentFerdigeUtenPost(client)
    if (ferdige.length === 0) return { behandlet: 0, postet: 0 }

    const hd = await hentHovedligaData(client, now)

    let postet = 0
    for (const kamp of ferdige) {
        const post = lagKamppost(kamp, hd)
        if (!post) continue
        if (await insertKamppost(client, kamp.match_num, post)) postet++
    }

    return { behandlet: ferdige.length, postet }
}
