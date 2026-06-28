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

// En kamp som kommer senere i dag (etter morgenrapportens vindu) — grunnlag for en
// «dagens kamper»-seksjon med vittige prediksjoner. Lag kan være «Ikke avgjort» for
// sluttspillkamper der motstanderne ikke er klare ennå.
export interface AiKommendeKamp {
    matchNum: number
    hjemme: { tla: string; navn: string; flagg: string }
    borte: { tla: string; navn: string; flagg: string }
    runde: number
    rundeTekst: string
    avspark: string // klokkeslett i norsk tid, f.eks. «21:00»
    erNorgeKamp: boolean
}

export interface AiTabellRad {
    plass: number
    navn: string
    poeng: number
    deltaPoeng: number // poeng sanket i natt (siden forrige snapshot)
    deltaPlass: number | null // plasser klatret (+) / falt (−) i natt, null uten baseline
}

// Gårsdagens stilling (forrige snapshot) — rå plass/poeng per deltaker, slik at
// Claude selv kan regne ut diffen mot dagens `tabell` og kommentere hvordan ting
// utvikler seg. Tom liste når det ikke finnes baseline ennå.
export interface AiForrigeTabellRad {
    plass: number
    navn: string
    poeng: number
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
    forrigeDato: string | null // datoen gårsdagens stilling (forrigeTabell) er hentet fra
    antallKamper: number
    harBaseline: boolean
    kamper: AiKampKontekst[]
    kommende: AiKommendeKamp[] // dagens kamper som kommer (etter rapportvinduet)
    tabell: AiTabellRad[] // dagens stilling (hele ligaen), med nattens delta
    forrigeTabell: AiForrigeTabellRad[] // gårsdagens stilling (hele ligaen) — for diff
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

    // Dagens kamper som kommer: kamper som starter etter rapportvinduet (08:00) og
    // innen det neste døgnet. Grunnlag for en «dagens kamper»-seksjon med vittige
    // prediksjoner. For sluttspillkamper kan motstanderne være uavklart ennå.
    const kommendeFra = til
    const kommendeTil = new Date(til.getTime() + RAPPORT_VINDU_TIMER * 60 * 60 * 1000)
    const kommendeKamper = alleKamper
        .filter((m) => {
            const start = new Date(m.game_start)
            return start > kommendeFra && start <= kommendeTil
        })
        .sort((a, b) => new Date(a.game_start).getTime() - new Date(b.game_start).getTime())
    // Sluttspill-override (lag satt via /sluttspill) ligger i match_scores selv om
    // kampen ikke er spilt — slå dem opp så vi viser riktige motstandere.
    const kommendeNums = kommendeKamper.map((m) => m.match_num)
    const kommendeOverrideRows = kommendeNums.length
        ? (
              await client.query<{
                  match_num: number
                  home_team_override: string | null
                  away_team_override: string | null
              }>(
                  `SELECT match_num, home_team_override, away_team_override
                   FROM match_scores WHERE match_num = ANY($1)`,
                  [kommendeNums],
              )
          ).rows
        : []
    const kommendeOverrideMap = new Map(kommendeOverrideRows.map((r) => [r.match_num, r]))
    const osloKlokke = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Oslo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })
    const lagInfo = (tla: string) => ({
        tla,
        navn: tla ? hentNorsk(tla) : 'Ikke avgjort',
        flagg: hentFlag(tla),
    })
    const kommende: AiKommendeKamp[] = kommendeKamper.map((m): AiKommendeKamp => {
        const ov = kommendeOverrideMap.get(m.match_num)
        const homeTla = ov?.home_team_override ?? m.home_team
        const awayTla = ov?.away_team_override ?? m.away_team
        return {
            matchNum: m.match_num,
            hjemme: lagInfo(homeTla),
            borte: lagInfo(awayTla),
            runde: m.round,
            rundeTekst: rundeTilTekst(m.round),
            avspark: osloKlokke.format(new Date(m.game_start)),
            erNorgeKamp: erNorgeKamp(homeTla, awayTla),
        }
    })

    // Dagens ledertavle — hele ligaen, med nattens poeng-/plass-endring. Vi sender
    // hele tabellen (ikke bare toppen) slik at Claude kan regne diffen mot gårsdagen
    // for alle deltakere, ikke bare teten.
    const aiTabell: AiTabellRad[] = tabell.map((r: LeaderBoard) => {
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

    // Gårsdagens ledertavle (forrige snapshot) — rå plass/poeng per deltaker. Navn
    // slås opp i dagens navn-map (de aller fleste går igjen); ukjente faller tilbake
    // til «ukjent». Sortert på plass slik at Claude lett kan sammenligne med dagens.
    const forrigeTabell: AiForrigeTabellRad[] = forrigeRader
        .map((r) => ({
            plass: r.plass,
            navn: navnMap.get(r.user_id) ?? 'ukjent',
            poeng: r.poeng,
        }))
        .sort((a, b) => a.plass - b.plass || b.poeng - a.poeng)

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
        forrigeDato,
        antallKamper: kamper.length,
        harBaseline,
        kamper,
        kommende,
        tabell: aiTabell,
        forrigeTabell,
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

const SYSTEM_PROMPT = `Du er en skarp, lattermild sportskommentator for en privat tippeliga blant venner under fotball-VM 2026. Du skriver morgenrapporten: en oppsummering av nattens kamper og hva som skjedde i ligaen.

Tone og stil:
- Skriv på norsk bokmål (ikke dialekt). Levende, leken kommentatorstil — som en radiokommentator med glimt i øyet, til tider litt spydig.
- Bruk gjerne tørre ordspill og erting, både på lagene som spilte OG på deltakerne som tippet på dem.
- Emoji er lov og oppmuntret, men ikke overdriv (1–2 per seksjon).
- Vær konkret: bruk faktiske navn, resultater og poeng fra dataene. Aldri dikt opp tall, kamper eller navn som ikke står i konteksten.
- Du kan bruke linjeskift i seksjonsteksten (og ingressen) for å dele opp i flere avsnitt når det gjør teksten lettere å lese. Skriv et reelt linjeskift mellom avsnittene.

Fotballkunnskap og overraskelser:
- Bruk din egen kunnskap om landenes fotballhistorie og -nivå til å fargelegge kampene: nasjonale spillestiler og klisjeer (brasiliansk samba og «o jogo bonito», tysk effektivitet, italiensk catenaccio, engelsk «it's coming home»-håp, nederlandsk totalfotball osv.) er gode å spille på. Bruk også klisjeer rundt selve landet som ikke er fotball relaterte.
- Vurder hvert resultat opp mot hva man kunne forvente: en stormakt som taper eller spiller uavgjort mot en outsider er en overraskelse verdt å løfte fram, mens en favoritt som vinner stort er som forventet. Si tydelig fra når noe er et sjokkresultat — og knytt det gjerne til hvem i ligaen som turte (eller bommet på) å tippe det.
- Ikke dikt opp fakta om lagene (skader, spillere, tidligere kamper i akkurat dette VM-et). Hold deg til generell, velkjent fotballkunnskap og det som faktisk står i konteksten.

Tabell-utvikling:
- Konteksten har både «tabell» (dagens stilling, hele ligaen) og «forrigeTabell» (gårsdagens stilling). Bruk de to til å fortelle hvordan ting utvikler seg: hvem klatret, hvem falt, hvem nærmer seg teten. «tabell» har også ferdig utregnet deltaPoeng/deltaPlass for natten du kan lene deg på.

Vokabular (følg dette nøyaktig):
- Handlingen heter å «tippe»; et innsendt tipp er «tipset». Aldri «bette»/«gjette».
- En bonus-doblet kamp heter «joker». En joker som ga poeng «satt»; en som ga 0 poeng «brant».
- VM-vinner-tipset heter «vinner», toppscorer-tipset «toppscorer».

Innhold:
- Løft fram nattens poengkonge, endringene på toppen av tabellen, og tipsene som ga mest poeng.
- Joker-bruken er en viktig vinkel: hvem brente, hvem satt. Det er ikke nødvendig å liste alt og alle her, viktigst er gode treff, eller kamper der mange misset.
- HVIS Norge spilte i natt skal det være en tydelig og fremtredende del av rapporten — nordmenn elsker landslaget, så gjør et nummer ut av Norge-kampen og hvem som traff/bommet på den.
- HVIS «kommende» har kamper: avslutt med en egen seksjon om dagens kamper som venter. Skriv noen vittige, frekke prediksjoner for hver kamp — bruk fotballkunnskapen din om de to lagene. Nevn alltid hva slags runde det er (bruk «rundeTekst», f.eks. gruppespill, åttedelsfinale, kvartfinale) og avsparkstidspunktet («avspark»). HVIS Norge spiller senere i dag, hype den kampen ekstra.
- Hopp over vinkler det ikke er data for (ingen joker → ikke nevn joker; Norge spilte ikke → ikke finn på en Norge-vinkel; tom «kommende» → ingen seksjon om dagens kamper).

Det totale innholdet må ikke bli for langt. Helst maks 20 setninger. Det skal leses i en slags sosial feed på mobil Dette er viktig.
`

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
        ingress: {
            type: 'string',
            description:
                'Én til to setninger som setter scenen for natten. Linjeskift er lov hvis du vil dele opp i avsnitt.',
        },
        seksjoner: {
            type: 'array',
            description:
                'Rapportens deler — én per vinkel (kamper, tabell, beste tips, joker, Norge, dagens kommende kamper ...).',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    emoji: { type: 'string', description: 'Én emoji som passer seksjonen.' },
                    overskrift: { type: 'string', description: 'Kort overskrift for seksjonen.' },
                    tekst: {
                        type: 'string',
                        description:
                            'Selve kommentaren for seksjonen. Bruk gjerne linjeskift for å dele opp i flere avsnitt.',
                    },
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
// Hard øvre grense for hvor lenge vi venter på Claude før vi gir opp. Må ligge
// trygt under maxDuration på API-ruten (60 s) slik at vi alltid returnerer et
// svar selv om Anthropic-kallet henger — i stedet for at funksjonen blir drept
// midt i et await (som tidligere lot ruten «bare spinne» uten å returnere, og i
// verste fall lekket den ene pool-tilkoblingen auth-wrapperen holder).
const CLAUDE_TIMEOUT_MS = 55_000

export async function genererAiMorgenrapport(
    kontekst: MorgenrapportAiKontekst,
    modell: AiModellId = STANDARD_AI_MODELL,
): Promise<GenererAiMorgenrapportResultat> {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('Mangler ANTHROPIC_API_KEY')
    }
    const valgtModell = AI_MODELLER[modell]
    // maxRetries: 1 — én rask retry på transiente nettfeil, men ikke det
    // SDK-standard 2-retry × 10-min-timeout-budsjettet som kan henge i evigheter.
    const client = new Anthropic({ maxRetries: 1 })

    // effort tas kun med for modeller som støtter det (Sonnet); Haiku 4.5 400-er på
    // parameteren. Begge får structured output via format.
    const format = { type: 'json_schema' as const, schema: RAPPORT_SCHEMA }
    const output_config = valgtModell.støtterEffort ? { effort: 'medium' as const, format } : { format }

    // Streaming + AbortController gir en hard tidsgrense på hele kallet (skill-rådet
    // er å strømme lange/store svar for å unngå request-timeouts). Uten dette kunne
    // førstegangs-skjemakompilering + kald start sprenge serverless-timeouten.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS)
    const t0 = Date.now()
    console.log(
        `[ai-morgenrapport] kaller ${modell} (max_tokens=2000, kontekst≈${byggBrukerMelding(kontekst).length} tegn) …`,
    )

    let response: Anthropic.Message
    try {
        response = await client.messages
            .stream(
                {
                    model: modell,
                    max_tokens: 2000,
                    thinking: { type: 'disabled' },
                    output_config,
                    system: SYSTEM_PROMPT,
                    messages: [{ role: 'user', content: byggBrukerMelding(kontekst) }],
                },
                { signal: controller.signal },
            )
            .finalMessage()
    } catch (e) {
        if (controller.signal.aborted) {
            throw new Error(`Claude-kallet (${modell}) tidsavbrutt etter ${CLAUDE_TIMEOUT_MS / 1000} s`)
        }
        const detalj = e instanceof Error ? e.message : String(e)
        throw new Error(`Claude-kallet (${modell}) feilet: ${detalj}`)
    } finally {
        clearTimeout(timer)
    }

    console.log(
        `[ai-morgenrapport] ${modell} svarte etter ${Date.now() - t0} ms ` +
            `(stop=${response.stop_reason}, in=${response.usage.input_tokens}, ut=${response.usage.output_tokens})`,
    )

    if (response.stop_reason === 'refusal') {
        throw new Error(`Claude (${modell}) avviste forespørselen`)
    }

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
    const tStart = Date.now()
    console.log(`[ai-morgenrapport] bygger kontekst for ${rapportDato} …`)
    const kontekst = await byggMorgenrapportAiKontekst(client, rapportDato, now)
    console.log(
        `[ai-morgenrapport] kontekst bygd på ${Date.now() - tStart} ms ` +
            `(kamper=${kontekst.antallKamper}, baseline=${kontekst.harBaseline})`,
    )
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
    console.log(`[ai-morgenrapport] ferdig for ${rapportDato} på totalt ${Date.now() - tStart} ms`)
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
