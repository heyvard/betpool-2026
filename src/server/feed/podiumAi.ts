import Anthropic from '@anthropic-ai/sdk'
import { PoolClient } from 'pg'

import { erNorgeKamp } from '../../data/matches'
import { hentFlag, hentNorsk } from '../../utils/lag'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import { beregnPlasseringer } from './morgenrapport'
import { hentHovedligaData, sorterTabell } from './hovedligaData'
import { AI_MODELLER, AiModell, AiModellId, AiMorgenrapportKostnad, STANDARD_AI_MODELL } from './morgenrapportAi'

// Pallen-posten. Postes én gang, når superadmin har verifisert alle resultater
// og trykker knappen på /vinner-toppscorer: en feed-post som viser topp-3 i
// hovedligaen (Æresligaen) og lar Claude skrive en oppsummering av reisen
// deres — hva de traff på, jokerbruk, og om de landet vinner-/toppscorer-tipset.
// Speiler morgenrapportAi.ts sin kontrakt (kontekst → Claude → strukturert
// JSON → feed_posts), men er et engangs-kall, ikke en daglig jobb: idempotent
// via feed_posts_podium_unik_idx (kun én rad med kind='podium' noensinne).

export interface PodiumSpillerKontekst {
    plass: number
    userId: string
    navn: string
    picture: string | null
    poeng: number
    antallTippet: number
    riktigeUtfall: number
    riktigeResultater: number
    jokerSatt: number
    jokerBrent: number
    besteKamp: { kamp: string; poeng: number; rundeTekst: string } | null
    norgePoeng: number
    vantVinnerBonus: boolean
    vantToppscorerBonus: boolean
}

export interface PodiumAiKontekst {
    // null inntil superadmin har satt en vinner på /vinner-toppscorer — pallen
    // kan ikke postes før fasiten er verifisert og lagret der.
    vinner: { tla: string; navn: string; flagg: string } | null
    toppscorere: string[]
    topp3: PodiumSpillerKontekst[]
}

// Bygger konteksten Claude trenger: dagens (endelige) hovedliga-tabell, topp-3
// sin reise gjennom turneringen (treffsikkerhet, joker, beste tips, Norge-
// poeng), og den faktiske fasiten (vinner-lag + toppscorer-navn). Ren lesing.
export async function byggPodiumKontekst(
    client: PoolClient,
    opts?: { mockWinner?: string; mockTopscorerIds?: number[] },
): Promise<PodiumAiKontekst> {
    const { allBets, extended, leaderboard } = await hentHovedligaData(client)
    const tabell = sorterTabell(leaderboard)
    const plassMap = beregnPlasseringer(tabell)
    const topp3Rader = tabell.slice(0, 3)

    const fasit = allBets.tournamentResult ?? { winnerTeam: '', topscorerPlayerIds: [] }
    const winnerTeam = opts?.mockWinner ?? fasit.winnerTeam
    const topscorerIds = opts?.mockTopscorerIds ?? fasit.topscorerPlayerIds
    const toppscorere = topscorerIds.length
        ? (
              await client.query<{ name: string }>(`SELECT name FROM players WHERE id = ANY($1) ORDER BY name`, [
                  topscorerIds,
              ])
          ).rows.map((r) => r.name)
        : []

    const usersById = new Map(extended.users.map((u) => [u.id, u]))
    const betsByUser = new Map<string, typeof extended.bets>()
    for (const b of extended.bets) {
        const liste = betsByUser.get(b.user_id) ?? []
        liste.push(b)
        betsByUser.set(b.user_id, liste)
    }

    const topp3: PodiumSpillerKontekst[] = topp3Rader.map((r): PodiumSpillerKontekst => {
        const bets = betsByUser.get(r.userid) ?? []
        const u = usersById.get(r.userid)
        const jokerBets = bets.filter((b) => b.joker)
        const besteBet = [...bets].sort((a, b) => b.poeng - a.poeng)[0]
        const besteKamp =
            besteBet && besteBet.poeng > 0
                ? {
                      kamp: `${hentFlag(besteBet.home_team)} ${hentNorsk(besteBet.home_team)} – ${hentNorsk(besteBet.away_team)} ${hentFlag(besteBet.away_team)}`,
                      poeng: besteBet.poeng,
                      rundeTekst: rundeTilTekst(besteBet.round),
                  }
                : null
        return {
            plass: plassMap.get(r.userid)!,
            userId: r.userid,
            navn: r.userName,
            picture: r.picture,
            poeng: r.poeng,
            antallTippet: bets.length,
            riktigeUtfall: bets.filter((b) => b.riktigUtfall).length,
            riktigeResultater: bets.filter((b) => b.riktigResultat).length,
            jokerSatt: jokerBets.filter((b) => b.poeng > 0).length,
            jokerBrent: jokerBets.filter((b) => b.poeng === 0).length,
            besteKamp,
            norgePoeng: bets.filter((b) => erNorgeKamp(b.home_team, b.away_team)).reduce((s, b) => s + b.poeng, 0),
            vantVinnerBonus: (u?.winnerPoints ?? 0) > 0,
            vantToppscorerBonus: (u?.topscorerPoints ?? 0) > 0,
        }
    })

    return {
        vinner: winnerTeam ? { tla: winnerTeam, navn: hentNorsk(winnerTeam), flagg: hentFlag(winnerTeam) } : null,
        toppscorere,
        topp3,
    }
}

export interface AiPodiumSpillerTekst {
    userId: string
    emoji: string
    tekst: string
}

export interface AiPodium {
    tittel: string
    ingress: string
    spillere: AiPodiumSpillerTekst[]
}

export interface GenererAiPodiumResultat {
    modell: AiModellId
    rapport: AiPodium
    usage: { input_tokens: number; output_tokens: number }
    kostnad: AiMorgenrapportKostnad
}

const SYSTEM_PROMPT = `Du er den samme skarpe, lattermilde sportskommentatoren som skriver morgenrapportene for en privat tippeliga blant venner under fotball-VM 2026. Nå er turneringen ferdigspilt og resultatene verifisert — pallen er satt. Du skal skrive en kort, feirende oppsummering av reisen til hver av de tre som endte øverst i hovedligaen.

Tone og stil:
- Norsk bokmål (ikke dialekt). Levende, leken kommentatorstil med glimt i øyet.
- Dette er en seiersfeiring, ikke en vanlig morgenrapport — varm og anerkjennende tone, gjerne litt høytidelig på en humoristisk måte.
- Emoji er lov (1–2 per spiller), ikke overdriv.
- Vær konkret: bruk faktiske navn og tall fra konteksten. Aldri dikt opp fakta, kamper eller tall som ikke står der.

Vokabular (følg nøyaktig):
- Handlingen heter å «tippe»; et innsendt tipp er «tipset». Aldri «bette»/«gjette».
- En bonus-doblet kamp heter «joker». En joker som ga poeng «satt»; en som ga 0 poeng «brent».
- VM-vinner-tipset heter «vinner», toppscorer-tipset «toppscorer».

Innhold — én seksjon per spiller i «topp3» (matchet på userId):
- Fortell reisen deres: hvor mange kamper de tippet, hvor treffsikre de var (riktigeUtfall/riktigeResultater av antallTippet), og jokerbruk hvis den var nevneverdig (satt/brent).
- Nevn «besteKamp» hvis den finnes — det beste enkelttipset deres.
- Løft spesielt fram hvis de landet vinner-tipset og/eller toppscorer-tipset (vantVinnerBonus/vantToppscorerBonus) — det er sjeldent og fortjener ekstra skryt.
- Variér setningsoppbyggingen mellom de tre — ikke gjenta samme mal.
- Maks 4–5 setninger per spiller. Dette skal leses raskt i en sosial feed på mobil.

Skriv i tillegg en kort, felles tittel og ingress for hele posten som markerer at pallen nå er endelig og verifisert.`

function byggBrukerMelding(kontekst: PodiumAiKontekst): string {
    return [
        'Her er dataene for pallen. Skriv oppsummeringen basert KUN på disse tallene.',
        '',
        'JSON:',
        JSON.stringify(kontekst, null, 2),
    ].join('\n')
}

const PODIUM_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        tittel: { type: 'string', description: 'Kort, feirende tittel på posten (gjerne med ett ordspill).' },
        ingress: {
            type: 'string',
            description: 'Én til to setninger som markerer at pallen nå er verifisert og satt.',
        },
        spillere: {
            type: 'array',
            description: 'Én seksjon per spiller i topp3 — matchet på userId.',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    userId: { type: 'string', description: 'Samme userId som i konteksten sin topp3-liste.' },
                    emoji: { type: 'string', description: 'Én emoji som passer spilleren/plasseringen.' },
                    tekst: { type: 'string', description: 'Oppsummeringen av spillerens reise gjennom turneringen.' },
                },
                required: ['userId', 'emoji', 'tekst'],
            },
        },
    },
    required: ['tittel', 'ingress', 'spillere'],
} as const

// Deterministisk, faktabasert fallback-tekst — brukes når ANTHROPIC_MOCK=true
// (integrasjons-/e2e-tester) i stedet for å kalle det ekte Claude-APIet. Gir
// realistisk, forutsigbart innhold uten API-nøkkel eller nettverkskall.
function byggMockPodium(kontekst: PodiumAiKontekst): AiPodium {
    const emoji: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
    return {
        tittel: 'Pallen er satt! 🏆',
        ingress: 'Turneringen er ferdigspilt og resultatene verifisert — her er de tre som tok pallplassene.',
        spillere: kontekst.topp3.map((s) => ({
            userId: s.userId,
            emoji: emoji[s.plass] ?? '🏅',
            tekst: `${s.navn} endte på ${s.plass}. plass med ${s.poeng} poeng — ${s.riktigeResultater} eksakte resultater og ${s.riktigeUtfall} riktige utfall av ${s.antallTippet} tippede kamper.${s.vantVinnerBonus ? ' Landet vinner-tipset!' : ''}${s.vantToppscorerBonus ? ' Landet toppscorer-tipset!' : ''}`,
        })),
    }
}

const CLAUDE_TIMEOUT_MS = 55_000

export async function genererAiPodium(
    kontekst: PodiumAiKontekst,
    modell: AiModellId = STANDARD_AI_MODELL,
): Promise<GenererAiPodiumResultat> {
    // Testene mocker Anthropic-kallet i stedet for å bruke jest/nock-mocking —
    // ANTHROPIC_MOCK er en server-only env-variabel (aldri satt i produksjon)
    // som testStack.ts setter som standard, slik at e2e/integrasjonstester kan
    // kjøre uten API-nøkkel eller nettverkstilgang, med deterministisk innhold.
    if (process.env.ANTHROPIC_MOCK === 'true') {
        return {
            modell,
            rapport: byggMockPodium(kontekst),
            usage: { input_tokens: 0, output_tokens: 0 },
            kostnad: { inputTokens: 0, outputTokens: 0, usd: 0 },
        }
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('Mangler ANTHROPIC_API_KEY')
    }
    const valgtModell: AiModell = AI_MODELLER[modell]
    const client = new Anthropic({ maxRetries: 1 })

    const format = { type: 'json_schema' as const, schema: PODIUM_SCHEMA }
    const output_config = valgtModell.støtterEffort ? { effort: 'medium' as const, format } : { format }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS)
    console.log(`[ai-podium] kaller ${modell} (max_tokens=2000) …`)

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

    if (response.stop_reason === 'refusal') {
        throw new Error(`Claude (${modell}) avviste forespørselen`)
    }

    const tekst = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
    let rapport: AiPodium
    try {
        rapport = JSON.parse(tekst) as AiPodium
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

export interface PodiumDryRun {
    kontekst: PodiumAiKontekst
    modell: AiModellId
    rapport: AiPodium | null
    grunn?: 'fasit_ikke_satt'
    brukerMock?: boolean
    usage?: { input_tokens: number; output_tokens: number }
    kostnad?: AiMorgenrapportKostnad
}

// Ren forhåndsvisning: bygger konteksten og lar Claude skrive teksten, men
// skriver ingenting til DB. Superadmin bruker denne til å se hvordan posten
// blir før den faktisk postes. Kan bruke mock-data hvis vinner/toppscorer ikke
// er satt.
export async function kjørPodiumDryRun(
    client: PoolClient,
    modell: AiModellId = STANDARD_AI_MODELL,
    opts?: { mockWinner?: string; mockTopscorerIds?: number[] },
): Promise<PodiumDryRun> {
    const brukerMock = !!(opts?.mockWinner || opts?.mockTopscorerIds)
    const kontekst = await byggPodiumKontekst(client, opts)
    if (!kontekst.vinner) {
        return { kontekst, modell, rapport: null, grunn: 'fasit_ikke_satt' }
    }
    const { rapport, usage, kostnad } = await genererAiPodium(kontekst, modell)
    return { kontekst, modell, rapport, usage, kostnad, brukerMock }
}

const PODIUM_ACCENT = 'royal'

export interface PodiumLagreResultat {
    postet: boolean
    grunn?: 'allerede_postet' | 'fasit_ikke_satt'
    modell?: AiModellId
    kostnad?: AiMorgenrapportKostnad
}

// Den postende varianten: idempotent (kun én rad med kind='podium' noensinne,
// håndhevet av feed_posts_podium_unik_idx) og krever at superadmin har satt en
// vinner på /vinner-toppscorer først (det ER verifiseringen — se
// isInFirstRound.ts/tournament-result.ts for samme fasit-mønster).
export async function genererOgLagrePodium(
    client: PoolClient,
    opts: { modell?: AiModellId; createdAt?: Date } = {},
): Promise<PodiumLagreResultat> {
    const modell = opts.modell ?? STANDARD_AI_MODELL

    const finnes = await client.query(`SELECT 1 FROM feed_posts WHERE kind = 'podium'`)
    if (finnes.rowCount && finnes.rowCount > 0) return { postet: false, grunn: 'allerede_postet' }

    const kontekst = await byggPodiumKontekst(client)
    if (!kontekst.vinner) return { postet: false, grunn: 'fasit_ikke_satt' }

    const { rapport, kostnad } = await genererAiPodium(kontekst, modell)

    const data = {
        ai: true,
        modell,
        kostnad,
        vinner: kontekst.vinner,
        toppscorere: kontekst.toppscorere,
        topp3: kontekst.topp3.map((s) => ({
            plass: s.plass,
            userId: s.userId,
            navn: s.navn,
            picture: s.picture,
            poeng: s.poeng,
        })),
        spillere: rapport.spillere,
    }

    await client.query(
        `INSERT INTO feed_posts (kind, scenario, accent, tittel, body, data, created_at)
         VALUES ('podium', 'ai', $1, $2, $3, $4, COALESCE($5, now()))
         ON CONFLICT (kind) WHERE kind = 'podium' DO NOTHING`,
        [
            PODIUM_ACCENT,
            rapport.tittel,
            rapport.ingress,
            JSON.stringify(data),
            opts.createdAt ? opts.createdAt.toISOString() : null,
        ],
    )

    return { postet: true, modell, kostnad }
}
