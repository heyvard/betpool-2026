import { hentNorsk } from '../../utils/lag'

// Innkodede tekstmaler for feeden. Tonen er aktiv, leken sportskommentator —
// utropstegn og enkelte emoji er lov. Hver scenario-mal har FLERE varianter som
// velges deterministisk via `velgVariant(...)` (frø = match_num for kamp,
// datostreng for morgenrapport), slik at feeden varierer uten å bli tilfeldig:
// samme post gir samme tekst ved re-kjøring/backfill. Alle navn flettes inn ferdig.
// Råverdiene lagres i feed_posts.data slik fronten kan rendre strukturert.
//
// NB: kamp-poster genereres kamp for kamp, så de skal ALDRI hevde kveld/dag-
// omspennende superlativer («kveldens største napp» o.l.) — det vet vi ikke før
// alle kampene er ferdige. Slike fraser hører kun hjemme i morgenrapporten.

export type FeedAccent = 'win' | 'live' | 'gold' | 'stone' | 'royal'

export type KampScenario = 'sjeldent' | 'leder_bommet' | 'leder_best' | 'ingen_traff' | 'enstemmig' | 'sjokk' | 'joker'
export type MorgenScenario = 'endring' | 'lederbytte' | 'leder_holder'

export interface MalResultat {
    accent: FeedAccent
    tittel: string
    body: string
}

// Deterministisk variant-velger: hasher frøet til en stabil indeks. Samme frø →
// samme variant hver gang (viktig for idempotent backfill og forutsigbare tester).
export function velgVariant<T>(varianter: T[], frø: number | string): T {
    const s = String(frø)
    let h = 0
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) | 0
    }
    const idx = Math.abs(h) % varianter.length
    return varianter[idx]
}

// Tankestrek (–), ikke bindestrek, i resultater: «2–1».
export function formatResultat(home: number, away: number): string {
    return `${home}–${away}`
}

// Visningsnavn: kallenavn er allerede flettet inn i `name` på server-spørringen
// (COALESCE(kallenavn, name)); her kuttes en evt. e-post på «@» som siste utvei,
// samme mønster som ledertavla.
export function visningsnavn(navn: string): string {
    return navn.includes('@') ? navn.split('@')[0] : navn
}

// Lederens tippede resultat, f.eks. «2–0 til Brasil» eller «1–1».
export function formatTipp(home: number, away: number, homeTla: string, awayTla: string): string {
    const res = formatResultat(home, away)
    if (home > away) return `${res} til ${hentNorsk(homeTla)}`
    if (home < away) return `${res} til ${hentNorsk(awayTla)}`
    return res
}

// Skriv ut poengluke som «1 poeng» / «3 poeng».
export function formatLuke(poeng: number): string {
    return `${poeng} poeng`
}

function utfallTekst(utfall: 'H' | 'U' | 'B' | null, homeTla: string, awayTla: string): string {
    if (utfall === 'H') return `seier til ${hentNorsk(homeTla)}`
    if (utfall === 'B') return `seier til ${hentNorsk(awayTla)}`
    return 'uavgjort'
}

function flertall(n: number, ental: string, flertall: string): string {
    return n === 1 ? ental : flertall
}

// ── Kamp-scenarioer ────────────────────────────────────────────────────────

export interface SjeldentArgs {
    spillere: string[] // navn (allerede visningsklare)
    resultat: string
    antall: number
    totalt: number
    vekt: number
    poeng: number
    frø: number | string
}

const SJELDENT_TITTEL_ALENE: ((navn: string, resultat: string) => string)[] = [
    (n, r) => `${visningsnavn(n)} satt mutters alene med ${r}! 🎯`,
    (n, r) => `Blink! ${visningsnavn(n)} helt alene om ${r}`,
    (n, r) => `${visningsnavn(n)} leste ${r} som ingen andre 🔮`,
    (n, r) => `Helt på egenhånd: ${visningsnavn(n)} hadde ${r}`,
]

const SJELDENT_TITTEL_FLERE: ((antall: number, resultat: string) => string)[] = [
    (a, r) => `${a} kloke hoder hadde ${r} 🎯`,
    (a, r) => `Bare ${a} turte å tippe ${r}`,
    (a, r) => `${a} stykker så ${r} komme 👀`,
    (a, r) => `${a} traff blink på ${r}`,
]

const SJELDENT_BODY: ((a: SjeldentArgs) => string)[] = [
    (a) =>
        `Bare ${a.antall} av ${a.totalt} hadde eksakt resultat. Med rundevekt ×${a.vekt} blir det fete +${a.poeng} poeng. 💰`,
    (a) =>
        `${a.antall} av ${a.totalt} prikket inn resultatet — rundevekt ×${a.vekt} gir +${a.poeng} poeng rett i kassa.`,
    (a) => `Sjelden vare: ${a.antall} av ${a.totalt} traff blink. ×${a.vekt} i rundevekt = +${a.poeng} poeng!`,
    (a) =>
        `${a.antall} av ${a.totalt} hadde det eksakte resultatet. Ganget med rundevekt ×${a.vekt}: +${a.poeng} poeng.`,
]

export function malSjeldent(a: SjeldentArgs): MalResultat {
    const tittel =
        a.antall === 1
            ? velgVariant(SJELDENT_TITTEL_ALENE, a.frø)(a.spillere[0], a.resultat)
            : velgVariant(SJELDENT_TITTEL_FLERE, a.frø)(a.antall, a.resultat)
    const body = velgVariant(SJELDENT_BODY, a.frø)(a)
    return { accent: 'gold', tittel, body }
}

export interface LederBommetArgs {
    leder: string
    ledersTipp: string
    utfordrer: string
    poeng: number
    luke: string
    frø: number | string
}

const LEDER_BOMMET_TITTEL: ((leder: string) => string)[] = [
    (l) => `${visningsnavn(l)} gikk på en smell — 0 poeng 😬`,
    () => `Lederen bommet stygt: blank kamp`,
    (l) => `${visningsnavn(l)} skled på skallet — 0 poeng 🍌`,
    (l) => `Nada for ${visningsnavn(l)} denne gangen`,
]

const LEDER_BOMMET_BODY: ((a: LederBommetArgs) => string)[] = [
    (a) =>
        `Lederen tippet ${a.ledersTipp} og fikk ingenting. ${visningsnavn(a.utfordrer)} stakk av med ${a.poeng} og puster nå ${a.luke} bak i toppen. 🔥`,
    (a) =>
        `${a.ledersTipp} var lederens bud — og det holdt ikke. ${visningsnavn(a.utfordrer)} tok ${a.poeng} og er bare ${a.luke} bak.`,
    (a) =>
        `Lederen satset på ${a.ledersTipp}, men gikk tomhendt hjem. ${visningsnavn(a.utfordrer)} (+${a.poeng}) lukker gapet til ${a.luke}.`,
]

export function malLederBommet(a: LederBommetArgs): MalResultat {
    const tittel = velgVariant(LEDER_BOMMET_TITTEL, a.frø)(a.leder)
    const body = velgVariant(LEDER_BOMMET_BODY, a.frø)(a)
    return { accent: 'live', tittel, body }
}

export interface LederBestArgs {
    navn: string
    poeng: number
    resultat: string
    sum: number
    antallRiktige: number
    totalt: number
    erLeder: boolean
    frø: number | string
}

const LEDER_BEST_TITTEL: ((navn: string, poeng: number) => string)[] = [
    (n, p) => `${visningsnavn(n)} tok ${p} poeng — best i kampen! 🏆`,
    (n, p) => `${visningsnavn(n)} herjet med ${p} poeng`,
    (n, p) => `Kampens fangst: ${visningsnavn(n)} med ${p} poeng`,
    (n, p) => `${visningsnavn(n)} mente alvor — ${p} poeng`,
]

const LEDER_BEST_ALENE: ((resultat: string) => string)[] = [
    (r) => `Eneste sjel med riktig resultat (${r}).`,
    (r) => `Helt alene om det riktige resultatet (${r}).`,
]

const LEDER_BEST_FLERE: ((a: LederBestArgs) => string)[] = [
    (a) => `${a.antallRiktige} av ${a.totalt} hadde riktig resultat (${a.resultat}).`,
    (a) => `${a.antallRiktige} av ${a.totalt} prikket inn ${a.resultat}.`,
]

export function malLederBest(a: LederBestArgs): MalResultat {
    const tittel = velgVariant(LEDER_BEST_TITTEL, a.frø)(a.navn, a.poeng)
    let førsteSetning: string
    if (a.antallRiktige === 1) {
        førsteSetning = velgVariant(LEDER_BEST_ALENE, a.frø)(a.resultat)
    } else if (a.antallRiktige > 1) {
        førsteSetning = velgVariant(LEDER_BEST_FLERE, a.frø)(a)
    } else {
        førsteSetning = `Traff utfallet i ${a.resultat}.`
    }
    const ledelse = a.erLeder ? `Beholder tronen med ${a.sum} poeng. 👑` : `Står med ${a.sum} poeng sammenlagt.`
    return { accent: 'win', tittel, body: `${førsteSetning} ${ledelse}` }
}

export interface IngenTraffArgs {
    totalt: number
    resultat: string
    utfall: 'H' | 'U' | 'B' | null
    homeTla: string
    awayTla: string
    antallUtfall: number
    frø: number | string
}

const INGEN_TRAFF_TITTEL: string[] = [
    'Den så ingen komme 🙈',
    'Bom på hele linja — ingen hadde resultatet',
    'Blankt ark: ingen traff resultatet',
    'Resultatet overrasket alle',
]

export function malIngenTraff(a: IngenTraffArgs): MalResultat {
    const tittel = velgVariant(INGEN_TRAFF_TITTEL, a.frø)
    const utfall = utfallTekst(a.utfall, a.homeTla, a.awayTla)
    const body = velgVariant(
        [
            `0 av ${a.totalt} hadde ${a.resultat}. ${a.antallUtfall} berget i det minste ${utfall} og deler utfallspoengene.`,
            `Ingen av ${a.totalt} prikket inn ${a.resultat}. ${a.antallUtfall} traff ${utfall} og må dele utfallspoengene.`,
        ],
        a.frø,
    )
    return { accent: 'stone', tittel, body }
}

export interface EnstemmigArgs {
    totalt: number
    resultat: string
    utfall: 'H' | 'U' | 'B' | null
    homeTla: string
    awayTla: string
    frø: number | string
}

const ENSTEMMIG_TITTEL: string[] = [
    'Enstemmig dom i salen ⚖️',
    'Alle så den komme',
    'Ingen tvil: hele gjengen traff utfallet',
]

export function malEnstemmig(a: EnstemmigArgs): MalResultat {
    const utfall = utfallTekst(a.utfall, a.homeTla, a.awayTla)
    const tittel = velgVariant(ENSTEMMIG_TITTEL, a.frø)
    const body = velgVariant(
        [
            `Alle ${a.totalt} tippet ${utfall}. Her ble ingen overrasket — det endte ${a.resultat}.`,
            `${a.totalt} av ${a.totalt} hadde ${utfall}. Sjelden enighet i en pulje som ellers krangler om alt. Resultat: ${a.resultat}.`,
        ],
        a.frø,
    )
    return { accent: 'win', tittel, body }
}

export interface SjokkArgs {
    totalt: number
    resultat: string
    utfall: 'H' | 'U' | 'B' | null
    homeTla: string
    awayTla: string
    frø: number | string
}

const SJOKK_TITTEL: string[] = [
    'SJOKK! Ingen så den komme 😱',
    'Kollektiv kalddusj — ingen traff utfallet',
    'Hele puljen bommet på utfallet',
]

export function malSjokk(a: SjokkArgs): MalResultat {
    const utfall = utfallTekst(a.utfall, a.homeTla, a.awayTla)
    const tittel = velgVariant(SJOKK_TITTEL, a.frø)
    const body = velgVariant(
        [
            `${a.resultat} til slutt — og 0 av ${a.totalt} hadde riktig utfall. Tippekupongene kan rives i stykker.`,
            `Ikke én eneste av ${a.totalt} traff ${utfall}. Resultatet ${a.resultat} satte alle på plass.`,
        ],
        a.frø,
    )
    return { accent: 'live', tittel, body }
}

export interface JokerArgs {
    navn: string
    poeng: number
    resultat: string
    satt: boolean
    frø: number | string
}

const JOKER_SATT_TITTEL: ((navn: string) => string)[] = [
    (n) => `${visningsnavn(n)} satset jokeren — og den satt! 🃏`,
    (n) => `Jokeren klaffet for ${visningsnavn(n)} 🎰`,
    (n) => `${visningsnavn(n)} doblet med joker og lo hele veien`,
]

const JOKER_SATT_BODY: ((a: JokerArgs) => string)[] = [
    (a) => `Joker på kampen ga ${a.poeng} poeng for ${visningsnavn(a.navn)}. ${a.resultat} ble fasiten — godt lest.`,
    (a) =>
        `${visningsnavn(a.navn)} satte jokeren på denne og ble belønnet med ${a.poeng} poeng da det endte ${a.resultat}.`,
]

const JOKER_BRANT_TITTEL: ((navn: string) => string)[] = [
    (n) => `${visningsnavn(n)} brente jokeren 💸`,
    (n) => `Jokeren gikk i grøfta for ${visningsnavn(n)} 🃏`,
    (n) => `${visningsnavn(n)} doblet — og det svei`,
]

const JOKER_BRANT_BODY: ((a: JokerArgs) => string)[] = [
    (a) =>
        `Joker på kampen, men ${a.resultat} ga null uttelling. Den dobbelen vil ${visningsnavn(a.navn)} helst glemme.`,
    (a) => `${visningsnavn(a.navn)} satset jokeren og fikk ingenting igjen da det endte ${a.resultat}. Au.`,
]

export function malJoker(a: JokerArgs): MalResultat {
    const tittel = a.satt
        ? velgVariant(JOKER_SATT_TITTEL, a.frø)(a.navn)
        : velgVariant(JOKER_BRANT_TITTEL, a.frø)(a.navn)
    const body = a.satt ? velgVariant(JOKER_SATT_BODY, a.frø)(a) : velgVariant(JOKER_BRANT_BODY, a.frø)(a)
    return { accent: 'gold', tittel, body }
}

// ── Morgenrapport-scenarioer ───────────────────────────────────────────────

export interface EndringArgs {
    antallKamper: number
    størsteKlatrer: { navn: string; n: number; plass: number } | null
    størsteFaller: { navn: string; n: number; plass: number } | null
    nyTopp3: boolean
    frø: number | string
}

const ENDRING_TITTEL: ((antallKamper: number) => string)[] = [
    (k) => `${k} ${flertall(k, 'kamp', 'kamper')} avgjort i går`,
    (k) => `Natta ga ${k} ${flertall(k, 'kamp', 'kamper')} — og bevegelse i tabellen`,
    (k) => `Tabellen rørte på seg: ${k} ${flertall(k, 'kamp', 'kamper')} i boks`,
]

export function malEndring(a: EndringArgs): MalResultat {
    const tittel = velgVariant(ENDRING_TITTEL, a.frø)(a.antallKamper)
    const deler: string[] = []
    if (a.størsteKlatrer) {
        const k = a.størsteKlatrer
        deler.push(
            velgVariant(
                [
                    `${visningsnavn(k.navn)} spurtet ${k.n} ${flertall(k.n, 'plass', 'plasser')} opp til ${k.plass}. 📈`,
                    `${visningsnavn(k.navn)} klatret ${k.n} ${flertall(k.n, 'plass', 'plasser')} til ${k.plass}.`,
                ],
                a.frø,
            ),
        )
    }
    if (a.størsteFaller) {
        const f = a.størsteFaller
        deler.push(
            velgVariant(
                [
                    `${visningsnavn(f.navn)} raste ${f.n} ned til ${f.plass}. 📉`,
                    `${visningsnavn(f.navn)} falt ${f.n} til ${f.plass}.`,
                ],
                a.frø,
            ),
        )
    }
    deler.push(a.nyTopp3 ? 'Ny topp 3!' : 'Topp 3 står som støpt.')
    return { accent: 'royal', tittel, body: deler.join(' ') }
}

export interface LederbytteArgs {
    nyLeder: string
    gammelLeder: string
    luke: string
    dager: number
    frø: number | string
}

const LEDERBYTTE_TITTEL: ((nyLeder: string) => string)[] = [
    (n) => `${visningsnavn(n)} har kuppet tronen 👑`,
    (n) => `Maktskifte! ${visningsnavn(n)} er ny leder`,
    (n) => `${visningsnavn(n)} har tatt ledelsen`,
]

export function malLederbytte(a: LederbytteArgs): MalResultat {
    const tittel = velgVariant(LEDERBYTTE_TITTEL, a.frø)(a.nyLeder)
    const body = velgVariant(
        [
            `Snek seg forbi ${visningsnavn(a.gammelLeder)} i natt og leder nå med ${a.luke} poeng. ${visningsnavn(
                a.gammelLeder,
            )} satt på tronen i ${a.dager} ${flertall(a.dager, 'dag', 'dager')}.`,
            `${visningsnavn(a.gammelLeder)} måtte gi tapt etter ${a.dager} ${flertall(
                a.dager,
                'dag',
                'dager',
            )} på topp. ${visningsnavn(a.nyLeder)} leder nå med ${a.luke} poeng.`,
        ],
        a.frø,
    )
    return { accent: 'gold', tittel, body }
}

export interface LederHolderArgs {
    leder: string
    luke: string
    dager: number
    frø: number | string
}

const LEDER_HOLDER_TITTEL: ((leder: string) => string)[] = [
    (l) => `${visningsnavn(l)} sitter trygt på tronen 👑`,
    (l) => `Kongen vakler ikke — ${visningsnavn(l)} leder fortsatt`,
    (l) => `${visningsnavn(l)} holder stand på topp`,
]

export function malLederHolder(a: LederHolderArgs): MalResultat {
    const tittel = velgVariant(LEDER_HOLDER_TITTEL, a.frø)(a.leder)
    const body = velgVariant(
        [
            `Nok en natt på toppen for ${visningsnavn(a.leder)}, som har ledet ${a.dager} ${flertall(
                a.dager,
                'dag',
                'dager',
            )} på rad og har ${a.luke} poeng ned til neste. 💪`,
            `${visningsnavn(a.leder)} ga seg ikke i natt heller — ${a.dager} ${flertall(
                a.dager,
                'dag',
                'dager',
            )} sammenhengende på topp, ${a.luke} poeng klar.`,
        ],
        a.frø,
    )
    return { accent: 'gold', tittel, body }
}
