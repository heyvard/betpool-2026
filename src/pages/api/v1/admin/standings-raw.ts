import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'

interface VariantResultat {
    url: string
    status: number | null
    ok: boolean
    // Antall standings-objekter, og en kort oppsummering av stage/type/group
    // for hver — gjør det lett å se strukturen selv om tabellene er tomme.
    antallStandings: number | null
    oppsummering: Array<{ stage: string; type: string; group: string | null; rader: number }> | null
    body: unknown
    feil?: string
}

async function hentVariant(url: string, token: string): Promise<VariantResultat> {
    try {
        const apiRes = await fetch(url, { headers: { 'X-Auth-Token': token } })
        const text = await apiRes.text()
        let body: unknown
        try {
            body = JSON.parse(text)
        } catch {
            body = text
        }

        let antallStandings: number | null = null
        let oppsummering: VariantResultat['oppsummering'] = null
        if (body && typeof body === 'object' && Array.isArray((body as { standings?: unknown }).standings)) {
            const standings = (body as { standings: Array<Record<string, unknown>> }).standings
            antallStandings = standings.length
            oppsummering = standings.map((s) => ({
                stage: String(s.stage ?? ''),
                type: String(s.type ?? ''),
                group: (s.group as string | null) ?? null,
                rader: Array.isArray(s.table) ? s.table.length : 0,
            }))
        }

        return { url, status: apiRes.status, ok: apiRes.ok, antallStandings, oppsummering, body }
    } catch (e) {
        return { url, status: null, ok: false, antallStandings: null, oppsummering: null, body: null, feil: String(e) }
    }
}

// Superadmin-debug: henter standings rett fra football-data.org og returnerer
// rå-responsen (+ status og en struktur-oppsummering) for et par URL-varianter,
// så vi kan se nøyaktig hva API-et svarer for VM-en.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { req, res, user } = opts
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    const token = process.env.FOOTBALL_DATA_TOKEN
    if (!token) {
        res.status(500).json({ error: 'Mangler FOOTBALL_DATA_TOKEN' })
        return
    }

    // ?season= for å overstyre. Default henter vi to varianter for å vise
    // forskjellen: uten season-parameter (det produksjon bruker — gir per-gruppe-
    // tabeller, type TOTAL, group "Group A") og med season=2026 (gir bare én
    // samlet GROUP_STAGE-tabell med group: null — derfor ble gruppene borte).
    const season = typeof req.query.season === 'string' ? req.query.season : null

    const varianter = season
        ? [`${BASE_URL}/competitions/${COMPETITION}/standings?season=${season}`]
        : [
              `${BASE_URL}/competitions/${COMPETITION}/standings`,
              `${BASE_URL}/competitions/${COMPETITION}/standings?season=2026`,
          ]

    const resultater: VariantResultat[] = []
    for (const url of varianter) {
        resultater.push(await hentVariant(url, token))
    }

    res.status(200).json({ competition: COMPETITION, resultater })
}

export default auth(handler)
