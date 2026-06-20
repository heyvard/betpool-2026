import { hentNorsk } from '../../utils/lag'

// Innkodede tekstmaler for feeden. Tonen er tørr, saklig sportskommentator —
// ingen utropstegn, ingen emoji i selve teksten. Alle navn flettes inn ferdig.
// Råverdiene lagres i feed_posts.data slik fronten kan rendre strukturert.

export type FeedAccent = 'win' | 'live' | 'gold' | 'stone' | 'royal'

export type KampScenario = 'sjeldent' | 'leder_bommet' | 'leder_best' | 'ingen_traff'
export type MorgenScenario = 'endring' | 'lederbytte'

export interface MalResultat {
    accent: FeedAccent
    tittel: string
    body: string
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

// ── Kamp-scenarioer ────────────────────────────────────────────────────────

export interface SjeldentArgs {
    spillere: string[] // navn (allerede visningsklare)
    resultat: string
    antall: number
    totalt: number
    vekt: number
    poeng: number
    superlativ?: string
}

export function malSjeldent(a: SjeldentArgs): MalResultat {
    const tittel =
        a.antall === 1
            ? `${visningsnavn(a.spillere[0])} satt alene med ${a.resultat}`
            : `${a.antall} hadde ${a.resultat}`
    const superlativDel = a.superlativ ? ` — ${a.superlativ}` : ''
    const body = `${a.antall} av ${a.totalt} hadde eksakt resultat. Med rundevekt ×${a.vekt}: +${a.poeng} poeng${superlativDel}.`
    return { accent: 'gold', tittel, body }
}

export interface LederBommetArgs {
    leder: string
    ledersTipp: string
    utfordrer: string
    poeng: number
    luke: string
}

export function malLederBommet(a: LederBommetArgs): MalResultat {
    const tittel = `${visningsnavn(a.leder)} bommet — 0 poeng`
    const body = `Lederen tippet ${a.ledersTipp}. ${visningsnavn(a.utfordrer)} tok ${a.poeng} og er nå ${a.luke} bak i toppen.`
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
}

export function malLederBest(a: LederBestArgs): MalResultat {
    const tittel = `${visningsnavn(a.navn)} tok ${a.poeng} poeng — best i kampen`
    let førsteSetning: string
    if (a.antallRiktige === 1) {
        førsteSetning = `Eneste med riktig resultat (${a.resultat}).`
    } else if (a.antallRiktige > 1) {
        førsteSetning = `${a.antallRiktige} av ${a.totalt} hadde riktig resultat (${a.resultat}).`
    } else {
        førsteSetning = `Traff utfallet i ${a.resultat}.`
    }
    const ledelse = a.erLeder ? `Beholder ledelsen med ${a.sum} poeng.` : `Står med ${a.sum} poeng sammenlagt.`
    return { accent: 'win', tittel, body: `${førsteSetning} ${ledelse}` }
}

export interface IngenTraffArgs {
    totalt: number
    resultat: string
    utfall: 'H' | 'U' | 'B' | null
    homeTla: string
    awayTla: string
    antallUtfall: number
}

export function malIngenTraff(a: IngenTraffArgs): MalResultat {
    const tittel = 'Ingen traff resultatet'
    const utfall = utfallTekst(a.utfall, a.homeTla, a.awayTla)
    const body = `0 av ${a.totalt} hadde ${a.resultat}. ${a.antallUtfall} traff ${utfall} og deler utfallspoengene.`
    return { accent: 'stone', tittel, body }
}

// ── Morgenrapport-scenarioer ───────────────────────────────────────────────

export interface EndringArgs {
    antallKamper: number
    størsteKlatrer: { navn: string; n: number; plass: number } | null
    størsteFaller: { navn: string; n: number; plass: number } | null
    nyTopp3: boolean
}

export function malEndring(a: EndringArgs): MalResultat {
    const tittel = `${a.antallKamper} ${a.antallKamper === 1 ? 'kamp' : 'kamper'} avgjort i går`
    const deler: string[] = []
    if (a.størsteKlatrer) {
        deler.push(
            `${visningsnavn(a.størsteKlatrer.navn)} klatret ${a.størsteKlatrer.n} ${
                a.størsteKlatrer.n === 1 ? 'plass' : 'plasser'
            } til ${a.størsteKlatrer.plass}.`,
        )
    }
    if (a.størsteFaller) {
        deler.push(`${visningsnavn(a.størsteFaller.navn)} falt ${a.størsteFaller.n} til ${a.størsteFaller.plass}.`)
    }
    deler.push(a.nyTopp3 ? 'Ny topp 3.' : 'Topp 3 ellers uendret.')
    return { accent: 'royal', tittel, body: deler.join(' ') }
}

export interface LederbytteArgs {
    nyLeder: string
    gammelLeder: string
    luke: string
    dager: number
}

export function malLederbytte(a: LederbytteArgs): MalResultat {
    const tittel = `${visningsnavn(a.nyLeder)} har tatt ledelsen`
    const body = `Gikk forbi ${visningsnavn(a.gammelLeder)} i natt og leder med ${a.luke} poeng. ${visningsnavn(
        a.gammelLeder,
    )} ledet i ${a.dager} ${a.dager === 1 ? 'dag' : 'dager'}.`
    return { accent: 'gold', tittel, body }
}
