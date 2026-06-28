import Anthropic from '@anthropic-ai/sdk'
import { PoolClient } from 'pg'

import { erNorgeKamp, hentKamper } from '../../data/matches'
import { resolveActiveScore } from '../../data/matchScore'
import { hentFlag, hentNorsk } from '../../utils/lag'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import { LeaderBoard } from '../../components/results/calculateAllScores'
import { hentHovedligaData, sorterTabell } from './hovedligaData'
import {
    beregnBunn,
    beregnJokerStatistikk,
    beregnNattensFangst,
    beregnPlasseringer,
    hentFerdigeKampnumre,
    RAPPORT_VINDU_TIMER,
    SnapshotRad,
} from './morgenrapport'
import { osloInstant } from './tid'

// AI-generert morgenrapport (dry run). Bygger en rik, serialiserbar kontekst om
// natten — nattens kamper, hvordan ledertavla endret seg, og hvilke tips som ga
// mest poeng — og lar Claude (Sonnet) skrive en sportskommentator-aktig
// oppsummering med tørre ordspill, joker-vinkling og ekstra trøkk på Norge.
//
// Dette er en parallell vei til den malbaserte genererMorgenrapport: den POSTER
// ingenting og skriver ingen snapshots. Kun superadmin trigger den manuelt og ser
// resultatet + API-kostnaden. Når teksten er god nok migreres strukturen inn i
// feeden og erstatter dagens morgenrapport.

// Modellene superadmin kan velge mellom i dry run-en, med pris per million
// tokens (USD) for kostnadsutregningen. `støtterEffort` skiller Sonnet (som tar
// output_config.effort) fra Haiku 4.5 (som IKKE støtter effort — den 400-er på
// parameteren). `navn` er etiketten UI-et viser.
export type AiModellId = 'claude-sonnet-4-6' | 'claude-haiku-4-5'

export interface AiModell {
    id: AiModellId
    navn: string
    inputUsdPerMtok: number
    outputUsdPerMtok: number
    støtterEffort: boolean
}

export const AI_MODELLER: Record<AiModellId, AiModell> = {
    'claude-sonnet-4-6': {
        id: 'claude-sonnet-4-6',
        navn: 'Sonnet',
        inputUsdPerMtok: 3,
        outputUsdPerMtok: 15,
        støtterEffort: true,
    },
    'claude-haiku-4-5': {
        id: 'claude-haiku-4-5',
        navn: 'Haiku',
        inputUsdPerMtok: 1,
        outputUsdPerMtok: 5,
        støtterEffort: false,
    },
}

export const STANDARD_AI_MODELL: AiModellId = 'claude-sonnet-4-6'

export function erGyldigModell(id: string): id is AiModellId {
    return id in AI_MODELLER
}

export interface AiKampKontekst {
    matchNum: number
    hjemme: { tla: string; navn: string; flagg: string }
    borte: { tla: string; navn: string; flagg: string }
    resultat: string | null // «2–1», eller null om resultatet ikke er satt
    runde: number
    rundeTekst: string
    erNorgeKamp: boolean
    antallTippet: number // antall hovedliga-tips på kampen
    antallRiktigUtfall: number // hvor mange traff H/U/B
    antallRiktigResultat: number // hvor mange traff eksakt resultat
}

export interface AiTabellRad {
    plass: number
    navn: string
    poeng: number
    deltaPoeng: number // poeng sanket i natt (siden forrige snapshot)
    deltaPlass: number | null // plasser klatret (+) / falt (−) i natt, null uten baseline
}

export interface AiBesteTips {
    navn: string
    kamp: string // «🇳🇴 Norge – Brasil 🇧🇷»
    tippet: string // «2–1»
    faktisk: string // «2–1»
    poeng: number
    riktigResultat: boolean
    joker: boolean
}

export interface AiJokerDetalj {
    navn: string
    kamp: string
    satt: boolean // true = ga poeng, false = brant
    poeng: number
}

export interface AiNorgeKontekst {
    spilte: boolean
    kamper: AiKampKontekst[]
    traff: { navn: string; tippet: string; poeng: number }[] // de som fikk poeng på en Norge-kamp
    bommet: number // antall som bommet helt (0 poeng) på Norge-kamper
}

export interface MorgenrapportAiKontekst {
    rapportDato: string
    antallKamper: number
    harBaseline: boolean
    kamper: AiKampKontekst[]
    tabell: AiTabellRad[]
    nattensPoengkonge: { navn: string; deltaPoeng: number; plass: number; delere: string[] } | null
    bunnstrid: { jumbo: string; poeng: number; nyJumbo: boolean; rømling: string | null; luke: number } | null
    besteTips: AiBesteTips[]
    joker: { satt: number; brent: number; totalt: number; detaljer: AiJokerDetalj[] }
    norge: AiNorgeKontekst
}

export interface AiMorgenrapportSeksjon {
    emoji: string
    overskrift: string
    tekst: string
}

export interface AiMorgenrapport {
    tittel: string
    ingress: string
    seksjoner: AiMorgenrapportSeksjon[]
}

export interface AiMorgenrapportKostnad {
    inputTokens: number
    outputTokens: number
    usd: number
}

export interface GenererAiMorgenrapportResultat {
    modell: AiModellId
    rapport: AiMorgenrapport
    usage: { input_tokens: number; output_tokens: number }
    kostnad: AiMorgenrapportKostnad
}

function kampNavn(k: AiKampKontekst): string {
    return `${k.hjemme.flagg} ${k.hjemme.navn} – ${k.borte.navn} ${k.borte.flagg}`.trim()
}

// Bygger hele konteksten Claude trenger om natten. Ren lesing — gjenbruker
// hovedliga-data, scoring-laget og morgenrapportens beregninger. Speiler vinduet
// til genererMorgenrapport: siste RAPPORT_VINDU_TIMER t fram til 08:00 Oslo på
// rapportdatoen.
export async function byggMorgenrapportAiKontekst(
    client: PoolClient,
    rapportDato: string,
    now: Date = new Date(),
): Promise<MorgenrapportAiKontekst> {
    const til = osloInstant(rapportDato, 8)
    const fra = new Date(til.getTime() - RAPPORT_VINDU_TIMER * 60 * 60 * 1000)
    const ferdigeKampnumre = await hentFerdigeKampnumre(client, fra, til)
    const ferdigeSet = new Set(ferdigeKampnumre)

    const { extended, leaderboard, scoreForKamp } = await hentHovedligaData(client, now)
    const tabell = sorterTabell(leaderboard)
    const navnMap = new Map(tabell.map((r) => [r.userid, r.userName]))
    const nyPlassMap = beregnPlasseringer(tabell)

    // Forrige snapshot (siste dato før rapportdatoen) — samme baseline som
    // genererMorgenrapport bruker. Kun lesing.
    const forrigeDatoRes = await client.query<{ dato: string }>(
        `SELECT max(dato)::text AS dato FROM feed_standings_snapshot WHERE dato < $1`,
        [rapportDato],
    )
    const forrigeDato = forrigeDatoRes.rows[0]?.dato ?? null
    const forrigeRader: SnapshotRad[] = forrigeDato
        ? (
              await client.query<SnapshotRad>(
                  `SELECT user_id, plass, poeng FROM feed_standings_snapshot WHERE dato = $1`,
                  [forrigeDato],
              )
          ).rows
        : []
    const harBaseline = forrigeRader.length > 0
    const forrigePoeng = new Map(forrigeRader.map((r) => [r.user_id, r.poeng]))
    const forrigePlass = new Map(forrigeRader.map((r) => [r.user_id, r.plass]))

    // Nattens kamper med resultat + treff-statistikk.
    const alleKamper = await hentKamper(client)
    const kampMap = new Map(alleKamper.map((m) => [m.match_num, m]))
    const scoreRows = (
        await client.query<{
            match_num: number
            home_score: number | null
            away_score: number | null
            synced_home_ft: number | null
            synced_away_ft: number | null
            use_manual: boolean
            home_team_override: string | null
            away_team_override: string | null
        }>(
            `SELECT match_num, home_score, away_score, synced_home_ft, synced_away_ft, use_manual,
                    home_team_override, away_team_override
             FROM match_scores WHERE match_num = ANY($1)`,
            [ferdigeKampnumre],
        )
    ).rows
    const scoreMap = new Map(scoreRows.map((s) => [s.match_num, s]))

    const kamper: AiKampKontekst[] = ferdigeKampnumre
        .map((num): AiKampKontekst | null => {
            const kamp = kampMap.get(num)
            if (!kamp) return null
            const score = scoreMap.get(num)
            const res = score ? resolveActiveScore(score) : { home_score: null, away_score: null }
            const homeTla = score?.home_team_override ?? kamp.home_team
            const awayTla = score?.away_team_override ?? kamp.away_team
            const mp = scoreForKamp.get(String(num))
            return {
                matchNum: num,
                hjemme: { tla: homeTla, navn: hentNorsk(homeTla), flagg: hentFlag(homeTla) },
                borte: { tla: awayTla, navn: hentNorsk(awayTla), flagg: hentFlag(awayTla) },
                resultat:
                    res.home_score !== null && res.away_score !== null ? `${res.home_score}–${res.away_score}` : null,
                runde: kamp.round,
                rundeTekst: rundeTilTekst(kamp.round),
                erNorgeKamp: erNorgeKamp(homeTla, awayTla),
                antallTippet: mp ? mp.hjemme + mp.uavgjort + mp.borte : 0,
                antallRiktigUtfall: mp?.antallRiktigeUtfall ?? 0,
                antallRiktigResultat: mp?.antallRiktigeSvar ?? 0,
            }
        })
        .filter((k): k is AiKampKontekst => k !== null)
        .sort((a, b) => a.runde - b.runde || a.matchNum - b.matchNum)

    // Ledertavla — topp 10 med nattens poeng-/plass-endring.
    const aiTabell: AiTabellRad[] = tabell.slice(0, 10).map((r: LeaderBoard) => {
        const fp = forrigePoeng.get(r.userid)
        const flp = forrigePlass.get(r.userid)
        return {
            plass: nyPlassMap.get(r.userid)!,
            navn: r.userName,
            poeng: r.poeng,
            deltaPoeng: fp !== undefined ? r.poeng - fp : 0,
            deltaPlass: flp !== undefined ? flp - nyPlassMap.get(r.userid)! : null,
        }
    })

    const fangst = beregnNattensFangst(tabell, nyPlassMap, forrigeRader)
    const bunn = beregnBunn(tabell, nyPlassMap, forrigeRader)
    const jokerStatistikk = beregnJokerStatistikk(extended, ferdigeSet)

    // Beste tips i natt: nattens bets sortert på poeng. Joker-detaljer hentes ut av
    // samme runde.
    const nattensBets = extended.bets.filter((b) => ferdigeSet.has(b.match_num))
    const besteTips: AiBesteTips[] = nattensBets
        .filter((b) => b.poeng > 0)
        .sort((a, b) => b.poeng - a.poeng)
        .slice(0, 8)
        .map((b) => {
            const k = kamper.find((kk) => kk.matchNum === b.match_num)
            return {
                navn: navnMap.get(b.user_id) ?? 'ukjent',
                kamp: k ? kampNavn(k) : `kamp ${b.match_num}`,
                tippet: `${b.home_score ?? '?'}–${b.away_score ?? '?'}`,
                faktisk: b.home_result === '' || b.away_result === '' ? '?' : `${b.home_result}–${b.away_result}`,
                poeng: b.poeng,
                riktigResultat: b.riktigResultat,
                joker: b.joker,
            }
        })

    const jokerDetaljer: AiJokerDetalj[] = nattensBets
        .filter((b) => b.joker)
        .map((b) => {
            const k = kamper.find((kk) => kk.matchNum === b.match_num)
            return {
                navn: navnMap.get(b.user_id) ?? 'ukjent',
                kamp: k ? kampNavn(k) : `kamp ${b.match_num}`,
                satt: b.poeng > 0,
                poeng: b.poeng,
            }
        })
        .sort((a, b) => b.poeng - a.poeng)

    // Norge-vinkel: nattens Norge-kamper + hvem som traff/bommet.
    const norgeKamper = kamper.filter((k) => k.erNorgeKamp)
    const norgeMatchNums = new Set(norgeKamper.map((k) => k.matchNum))
    const norgeBets = nattensBets.filter((b) => norgeMatchNums.has(b.match_num))
    const norgeTraff = norgeBets
        .filter((b) => b.poeng > 0)
        .sort((a, b) => b.poeng - a.poeng)
        .map((b) => ({
            navn: navnMap.get(b.user_id) ?? 'ukjent',
            tippet: `${b.home_score ?? '?'}–${b.away_score ?? '?'}`,
            poeng: b.poeng,
        }))

    return {
        rapportDato,
        antallKamper: kamper.length,
        harBaseline,
        kamper,
        tabell: aiTabell,
        nattensPoengkonge: fangst
            ? {
                  navn: fangst.topp.navn,
                  deltaPoeng: fangst.topp.deltaPoeng,
                  plass: fangst.topp.plass,
                  delere: fangst.delere,
              }
            : null,
        bunnstrid: bunn
            ? {
                  jumbo: bunn.jumbo.navn,
                  poeng: bunn.jumbo.poeng,
                  nyJumbo: bunn.nyJumbo,
                  rømling: bunn.rømling,
                  luke: bunn.luke,
              }
            : null,
        besteTips,
        joker: { ...jokerStatistikk, detaljer: jokerDetaljer },
        norge: {
            spilte: norgeKamper.length > 0,
            kamper: norgeKamper,
            traff: norgeTraff,
            bommet: norgeBets.filter((b) => b.poeng === 0).length,
        },
    }
}

const SYSTEM_PROMPT = `Du er en skarp, lattermild sportskommentator for «Æresligaen» — en privat tippeliga blant venner under fotball-VM 2026. Du skriver morgenrapporten: en oppsummering av nattens kamper og hva som skjedde i ligaen.

Tone og stil:
- Skriv på norsk bokmål (ikke dialekt). Levende, leken kommentatorstil — som en radiokommentator med glimt i øyet.
- Bruk gjerne tørre ordspill og lett erting, både på lagene som spilte OG på deltakerne som tippet på dem. Hold det vennlig — dette er kompiser.
- Emoji er lov og oppmuntret, men ikke overdriv (1–2 per seksjon).
- Vær konkret: bruk faktiske navn, resultater og poeng fra dataene. Aldri dikt opp tall, kamper eller navn som ikke står i konteksten.

Vokabular (følg dette nøyaktig):
- Handlingen heter å «tippe»; et innsendt tipp er «tipset». Aldri «bette»/«gjette».
- En bonus-doblet kamp heter «joker». En joker som ga poeng «satt»; en som ga 0 poeng «brant».
- VM-vinner-tipset heter «vinner», toppscorer-tipset «toppscorer».

Innhold:
- Løft fram nattens poengkonge, endringene på toppen av tabellen, og tipsene som ga mest poeng.
- Joker-bruken er en viktig vinkel: hvem brente, hvem satt.
- HVIS Norge spilte i natt skal det være en tydelig og fremtredende del av rapporten — nordmenn elsker landslaget, så gjør et nummer ut av Norge-kampen og hvem som traff/bommet på den.
- Hopp over vinkler det ikke er data for (ingen joker → ikke nevn joker; Norge spilte ikke → ikke finn på en Norge-vinkel).`

function byggBrukerMelding(kontekst: MorgenrapportAiKontekst): string {
    return [
        'Her er dataene for nattens morgenrapport. Skriv rapporten basert KUN på disse tallene.',
        '',
        'JSON:',
        JSON.stringify(kontekst, null, 2),
    ].join('\n')
}

const RAPPORT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        tittel: { type: 'string', description: 'Kort, fengende tittel på rapporten (gjerne med ett ordspill).' },
        ingress: { type: 'string', description: 'Én til to setninger som setter scenen for natten.' },
        seksjoner: {
            type: 'array',
            description: 'Rapportens deler — én per vinkel (kamper, tabell, beste tips, joker, Norge ...).',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    emoji: { type: 'string', description: 'Én emoji som passer seksjonen.' },
                    overskrift: { type: 'string', description: 'Kort overskrift for seksjonen.' },
                    tekst: { type: 'string', description: 'Selve kommentaren for seksjonen.' },
                },
                required: ['emoji', 'overskrift', 'tekst'],
            },
        },
    },
    required: ['tittel', 'ingress', 'seksjoner'],
} as const

// Kaller valgt Claude-modell (Sonnet/Haiku) med konteksten og returnerer den
// strukturerte rapporten + token-bruk og utregnet USD-kostnad. Kaster hvis
// ANTHROPIC_API_KEY mangler eller kallet/parsingen feiler.
export async function genererAiMorgenrapport(
    kontekst: MorgenrapportAiKontekst,
    modell: AiModellId = STANDARD_AI_MODELL,
): Promise<GenererAiMorgenrapportResultat> {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('Mangler ANTHROPIC_API_KEY')
    }
    const valgtModell = AI_MODELLER[modell]
    const client = new Anthropic()

    // effort tas kun med for modeller som støtter det (Sonnet); Haiku 4.5 400-er på
    // parameteren. Begge får structured output via format.
    const format = { type: 'json_schema' as const, schema: RAPPORT_SCHEMA }
    const output_config = valgtModell.støtterEffort ? { effort: 'medium' as const, format } : { format }

    const response = await client.messages.create({
        model: modell,
        max_tokens: 2000,
        thinking: { type: 'disabled' },
        output_config,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: byggBrukerMelding(kontekst) }],
    })

    const tekst = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
    let rapport: AiMorgenrapport
    try {
        rapport = JSON.parse(tekst) as AiMorgenrapport
    } catch {
        throw new Error('Klarte ikke å tolke svaret fra Claude som JSON')
    }

    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const usd =
        (inputTokens / 1_000_000) * valgtModell.inputUsdPerMtok +
        (outputTokens / 1_000_000) * valgtModell.outputUsdPerMtok

    return {
        modell,
        rapport,
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
        kostnad: { inputTokens, outputTokens, usd },
    }
}

export interface AiMorgenrapportDryRun {
    rapportDato: string
    modell: AiModellId
    antallKamper: number
    harBaseline: boolean
    kontekst: MorgenrapportAiKontekst
    rapport: AiMorgenrapport | null
    grunn?: 'ingen_kamper'
    usage?: { input_tokens: number; output_tokens: number }
    kostnad?: AiMorgenrapportKostnad
}

// Hele dry run-flyten: bygg kontekst → (hvis kamper) kall Claude med valgt modell.
// Returnerer alt superadmin trenger å se, uten å skrive noe til DB.
export async function kjørAiMorgenrapportDryRun(
    client: PoolClient,
    rapportDato: string,
    modell: AiModellId = STANDARD_AI_MODELL,
    now: Date = new Date(),
): Promise<AiMorgenrapportDryRun> {
    const kontekst = await byggMorgenrapportAiKontekst(client, rapportDato, now)
    if (kontekst.antallKamper === 0) {
        return {
            rapportDato,
            modell,
            antallKamper: 0,
            harBaseline: kontekst.harBaseline,
            kontekst,
            rapport: null,
            grunn: 'ingen_kamper',
        }
    }
    const { rapport, usage, kostnad } = await genererAiMorgenrapport(kontekst, modell)
    return {
        rapportDato,
        modell,
        antallKamper: kontekst.antallKamper,
        harBaseline: kontekst.harBaseline,
        kontekst,
        rapport,
        usage,
        kostnad,
    }
}
