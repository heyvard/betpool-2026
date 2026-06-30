// Innkodede tekstmaler for morgenrapporten i feeden. Tonen er aktiv, leken
// sportskommentator — utropstegn og enkelte emoji er lov. Hver scenario-mal har
// FLERE varianter som velges deterministisk via `velgVariant(...)` (frø =
// datostreng), slik at feeden varierer uten å bli tilfeldig: samme post gir samme
// tekst ved re-kjøring/backfill. Alle navn flettes inn ferdig. Råverdiene lagres i
// feed_posts.data slik fronten kan rendre strukturert.

export type FeedAccent = 'win' | 'live' | 'gold' | 'stone' | 'royal'

export type MorgenScenario = 'endring' | 'lederbytte' | 'leder_holder' | 'delt_ledelse'

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

// Visningsnavn: kallenavn er allerede flettet inn i `name` på server-spørringen
// (COALESCE(kallenavn, name)); her kuttes en evt. e-post på «@» som siste utvei,
// samme mønster som ledertavla.
export function visningsnavn(navn: string): string {
    return navn.includes('@') ? navn.split('@')[0] : navn
}

// Skriv ut poengluke som «1 poeng» / «3 poeng».
export function formatLuke(poeng: number): string {
    return `${poeng} poeng`
}

function flertall(n: number, ental: string, flertall: string): string {
    return n === 1 ? ental : flertall
}

// ── Morgenrapport-scenarioer ───────────────────────────────────────────────

// Bunnstriden («kjelleren»): hvem ligger sist, om jumboplassen byttet eier i natt,
// og hvor tett det er nederst. Brukes til den sportskommentar-aktige bunn-vinkelen
// i morgenrapporten — vi snakker også om dem som ligger langt ned på tabellen.
export interface BunnArgs {
    // Den som ligger sist (jumbo).
    jumbo: { navn: string; plass: number; poeng: number }
    // Byttet jumboplassen eier siden forrige rapport?
    nyJumbo: boolean
    // Forrige jumbo som klatret bort fra sisteplass (kun satt når nyJumbo).
    rømling: string | null
    // Poeng opp til nest sist — hvor tett bunnstriden er.
    luke: number
}

export interface EndringArgs {
    antallKamper: number
    størsteKlatrer: { navn: string; n: number; plass: number } | null
    størsteFaller: { navn: string; n: number; plass: number } | null
    nyTopp3: boolean
    // Hvem som gikk inn i topp 3 siden i går (med ny plass). Tom = ingen nye.
    nyeITopp3?: { navn: string; plass: number }[]
    // Nattens poenghøst — hovedvinkelen i morgenrapporten. Utelatt når ingen sanket
    // poeng (alle bommet) eller første aktive dag (ingen baseline).
    fangst?: NattensFangst | null
    // Bunnstriden. Utelatt tidlig i turneringen (alle på 0) og i små puljer.
    bunn?: BunnArgs | null
    frø: number | string
}

// Nattens poengkonge: hvem sanket flest poeng siden forrige snapshot. Dette er
// hovedvinkelen morgenrapporten skal lede med — ikke hvem som ligger sist.
export interface NattensFangst {
    // Toppsankeren i natt (visningsklart navn).
    topp: { navn: string; poeng: number; deltaPoeng: number; plass: number }
    // Andre som sanket NØYAKTIG like mange poeng i natt (visningsklare navn). Tom
    // = soloprestasjon. Brukes til «X og Y meide inn like mange».
    delere: string[]
}

// «Ada (2.)» / «Ada (2.) og Bo (3.)» / «Ada, Bo og Cleo». Norsk liste med «og».
function listeMedOg(navn: string[]): string {
    if (navn.length <= 1) return navn[0] ?? ''
    return `${navn.slice(0, -1).join(', ')} og ${navn[navn.length - 1]}`
}

const ENDRING_TITTEL: ((antallKamper: number) => string)[] = [
    (k) => `${k} ${flertall(k, 'kamp', 'kamper')} unnagjort — og full fart i tabellen`,
    (k) => `Natta ga ${k} ${flertall(k, 'kamp', 'kamper')} — og bevegelse i feltet`,
    (k) => `Tabellen rister: ${k} ${flertall(k, 'kamp', 'kamper')} i boks`,
    (k) => `For en omgang! ${k} ${flertall(k, 'kamp', 'kamper')} ferdigspilt i natt`,
    (k) => `Dommeren har blåst av ${k} ${flertall(k, 'kamp', 'kamper')} — her er fasiten`,
    (k) => `${k} ${flertall(k, 'kamp', 'kamper')} i kassa, og kortene er stokket om`,
]

// ── Nattens poengkonge ───────────────────────────────────────────────────────
// Hovedvinkelen: hvem meide inn flest poeng siden forrige rapport. Ren
// TV-kommentator-tone med fotball-metaforer. Egne varianter for solosanker vs.
// delt toppscorertittel («X og Y sanket like mange»).

const FANGST_ALENE: ((f: NattensFangst) => string)[] = [
    (f) => `Nattens toppscorer på kupongen: ${visningsnavn(f.topp.navn)} banket inn +${f.topp.deltaPoeng} poeng! 🔥`,
    (f) =>
        `Og DER, mine damer og herrer — ${visningsnavn(f.topp.navn)} meide inn +${f.topp.deltaPoeng} poeng i natt. For en forestilling!`,
    (f) => `Full klaff foran mål for ${visningsnavn(f.topp.navn)}: +${f.topp.deltaPoeng} poeng mens resten så på. ⚡`,
    (f) =>
        `${visningsnavn(f.topp.navn)} herjet i natt og dro i land +${f.topp.deltaPoeng} poeng — natta tilhørte ${visningsnavn(
            f.topp.navn,
        )}.`,
    (f) =>
        `Nydelig av ${visningsnavn(f.topp.navn)}! +${f.topp.deltaPoeng} poeng plukket i natt, mest av alle på kupongen.`,
    (f) => `Nattens skarpskytter er ${visningsnavn(f.topp.navn)}, som fyrte inn +${f.topp.deltaPoeng} poeng. 🎯`,
]

const FANGST_DELT: ((navn: string, delta: number) => string)[] = [
    (n, d) => `Dødt løp om nattens toppscorertittel: ${n} banket inn +${d} poeng hver! 🔥`,
    (n, d) => `Skulder ved skulder på poengjakten i natt — ${n} meide inn +${d} poeng hver.`,
    (n, d) => `${n} delte rollen som nattens skarpskyttere med +${d} poeng hver. Ikke en luke imellom.`,
]

// Én setning om nattens poengkonge. Forutsetter at fangsten finnes (kalleren
// sjekker null først). Navn er allerede visningsklare på server-spørringen.
export function fangstSetning(f: NattensFangst, frø: number | string): string {
    if (f.delere.length > 0) {
        const navn = listeMedOg([f.topp.navn, ...f.delere].map(visningsnavn))
        return velgVariant(FANGST_DELT, frø)(navn, f.topp.deltaPoeng)
    }
    return velgVariant(FANGST_ALENE, frø)(f)
}

// ── Bunnstriden ────────────────────────────────────────────────────────────
// Sportskommentar-vinkel på dem som ligger langt ned: jumboplassen og kjelleren.
// Tre toner: helt ny jumbo, en rømling som dyttet noen ned, eller samme stakkar
// som henger igjen nederst. `luke` flettes inn der det er tett.

const BUNN_NY_JUMBO: ((b: BunnArgs) => string)[] = [
    (b) => `Nederst i bunken: ${visningsnavn(b.jumbo.navn)} har overtatt jumboplassen (${b.jumbo.plass}.). 🪦`,
    (b) => `Ny mann i kjelleren — ${visningsnavn(b.jumbo.navn)} dumpet helt ned til ${b.jumbo.plass}. plass.`,
    (b) => `Bånnskrap: ${visningsnavn(b.jumbo.navn)} er fersk innehaver av sisteplassen.`,
]

const BUNN_RØMLING: ((b: BunnArgs) => string)[] = [
    (b) =>
        `${visningsnavn(b.rømling!)} rømte fra kjelleren i natt og overlot jumboplassen til ${visningsnavn(
            b.jumbo.navn,
        )}. 🪜`,
    (b) =>
        `${visningsnavn(b.rømling!)} klatret ut av bånn — nå er det ${visningsnavn(
            b.jumbo.navn,
        )} som holder skansen helt nederst.`,
]

const BUNN_SAMME: ((b: BunnArgs) => string)[] = [
    (b) => `${visningsnavn(b.jumbo.navn)} er fortsatt forankret på sisteplass (${b.jumbo.plass}.). ⚓`,
    (b) =>
        `Bunnstriden er tett: bare ${formatLuke(b.luke)} skiller ${visningsnavn(
            b.jumbo.navn,
        )} fra å rømme jumboplassen.`,
    (b) => `${visningsnavn(b.jumbo.navn)} henger fortsatt igjen i kjelleren — ingen redning i natt.`,
]

// Velger riktig bunn-setning ut fra om jumboplassen byttet eier. Når det er tett
// (≤ 2 poeng opp) og samme stakkar henger igjen, foretrekkes «tett»-varianten.
// Eksportert så alle morgenrapport-scenarioer kan flette bunnstriden inn i body —
// ikke bare «endring».
export function bunnSetning(b: BunnArgs, frø: number | string): string {
    if (b.nyJumbo && b.rømling) return velgVariant(BUNN_RØMLING, frø)(b)
    if (b.nyJumbo) return velgVariant(BUNN_NY_JUMBO, frø)(b)
    if (b.luke > 0 && b.luke <= 2) return BUNN_SAMME[1](b)
    return velgVariant(BUNN_SAMME, frø)(b)
}

export function malEndring(a: EndringArgs): MalResultat {
    const tittel = velgVariant(ENDRING_TITTEL, a.frø)(a.antallKamper)
    const deler: string[] = []
    // Nattens poengkonge leder an — det er denne rapporten skal handle om.
    if (a.fangst) {
        deler.push(fangstSetning(a.fangst, a.frø))
    }
    if (a.størsteKlatrer) {
        const k = a.størsteKlatrer
        deler.push(
            velgVariant(
                [
                    `${visningsnavn(k.navn)} spurtet ${k.n} ${flertall(k.n, 'plass', 'plasser')} opp til ${k.plass}. 📈`,
                    `${visningsnavn(k.navn)} klatret ${k.n} ${flertall(k.n, 'plass', 'plasser')} til ${k.plass}. plass.`,
                    `Fullt opprykk for ${visningsnavn(k.navn)}: ${k.n} ${flertall(
                        k.n,
                        'plass',
                        'plasser',
                    )} opp til ${k.plass}.`,
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
                    `${visningsnavn(f.navn)} raste ${f.n} ${flertall(f.n, 'plass', 'plasser')} ned til ${f.plass}. 📉`,
                    `${visningsnavn(f.navn)} datt ${f.n} ${flertall(f.n, 'plass', 'plasser')} til ${f.plass}. plass.`,
                    `Tungt for ${visningsnavn(f.navn)}, som tapte ${f.n} ${flertall(
                        f.n,
                        'plass',
                        'plasser',
                    )} og havnet på ${f.plass}.`,
                ],
                a.frø,
            ),
        )
    }
    const nyeITopp3 = a.nyeITopp3 ?? []
    if (nyeITopp3.length > 0) {
        const navn = listeMedOg(nyeITopp3.map((n) => `${visningsnavn(n.navn)} (${n.plass}.)`))
        deler.push(
            velgVariant(
                [
                    `Ny i topp 3: ${navn}.`,
                    `Inn på medaljeplass: ${navn}.`,
                    `Frisk luft i toppstriden — ny i topp 3: ${navn}.`,
                ],
                a.frø,
            ),
        )
    } else {
        deler.push(
            velgVariant(['Topp 3 står som støpt.', 'Pallen rikker seg ikke.', 'Medaljeplassene holder stand.'], a.frø),
        )
    }
    // Bunnstriden nevnes kun ved reell dramatikk (ny jumbo) — vi gidder ikke kjefte
    // på den samme stakkaren hver eneste morgen.
    if (a.bunn?.nyJumbo) {
        deler.push(bunnSetning(a.bunn, a.frø))
    }
    return { accent: 'royal', tittel, body: deler.join(' ') }
}

// ── Joker-oppsummering ───────────────────────────────────────────────────────
// Hvor mange jokere ble lagt på nattens (rapportvinduets) kamper, og hvor mange
// satt (ga poeng) vs. brant (ga null). Brukes til en egen joker-linje i
// morgenrapporten — vi vil eksplisitt fortelle hvor mange jokere som ble brent.
export interface JokerStatistikk {
    satt: number // jokere som ga > 0 poeng
    brent: number // jokere som ga 0 poeng
    totalt: number // satt + brent
}

const JOKER_BEGGE: ((s: JokerStatistikk) => string)[] = [
    (s) => `${s.brent} av ${s.totalt} ${flertall(s.totalt, 'joker', 'jokere')} brant i natt, ${s.satt} satt. 🃏`,
    (s) => `Nattens jokere: ${s.brent} gikk rett i grøfta, ${s.satt} traff blink.`,
    (s) => `Blandet jokerdrama: ${s.satt} klaffet, ${s.brent} endte på tribunen. 🃏`,
]

const JOKER_ALLE_BRANT: ((s: JokerStatistikk) => string)[] = [
    (s) => `Alle ${s.totalt} ${flertall(s.totalt, 'jokeren', 'jokerne')} brant i natt. 💸`,
    (s) => `Brutal jokernatt: ${s.totalt} lagt, ${s.totalt} skutt over mål. Au.`,
    (s) => `Kalddusj ved jokerbordet — ${s.totalt} av ${s.totalt} gikk i bakken.`,
]

const JOKER_ALLE_SATT: ((s: JokerStatistikk) => string)[] = [
    (s) => `Alle ${s.totalt} ${flertall(s.totalt, 'jokeren', 'jokerne')} satt som et skudd i natt! 🃏`,
    (s) => `Gyllen jokernatt: ${s.totalt} av ${s.totalt} traff rett i krysset.`,
    (s) => `Full pott på jokerne — ${s.totalt} av ${s.totalt} klaffet. 🎯`,
]

// Én setning om nattens jokere. Returnerer null når ingen jokere ble lagt på
// nattens kamper (da skal rapporten ikke nevne joker i det hele tatt).
export function jokerSetning(s: JokerStatistikk, frø: number | string): string | null {
    if (s.totalt === 0) return null
    if (s.brent > 0 && s.satt > 0) return velgVariant(JOKER_BEGGE, frø)(s)
    if (s.brent > 0) return velgVariant(JOKER_ALLE_BRANT, frø)(s)
    return velgVariant(JOKER_ALLE_SATT, frø)(s)
}

export interface LederbytteArgs {
    nyLeder: string
    gammelLeder: string
    luke: string
    dager: number
    frø: number | string
}

const LEDERBYTTE_TITTEL: ((nyLeder: string) => string)[] = [
    (n) => `${visningsnavn(n)} har kuppet ledelsen 🔥`,
    (n) => `Maktskifte på toppen! ${visningsnavn(n)} har overtatt`,
    (n) => `${visningsnavn(n)} har revet til seg gultrøya`,
    (n) => `Ny mann i tet — ${visningsnavn(n)} har slått til 👑`,
    (n) => `Tronskifte! ${visningsnavn(n)} troner øverst`,
]

export function malLederbytte(a: LederbytteArgs): MalResultat {
    const tittel = velgVariant(LEDERBYTTE_TITTEL, a.frø)(a.nyLeder)
    const body = velgVariant(
        [
            `Snek seg forbi ${visningsnavn(a.gammelLeder)} på overtid og leder nå med ${a.luke} poeng. ${visningsnavn(
                a.gammelLeder,
            )} satt på tronen i ${a.dager} ${flertall(a.dager, 'dag', 'dager')} før smellen.`,
            `${visningsnavn(a.gammelLeder)} måtte gi tapt etter ${a.dager} ${flertall(
                a.dager,
                'dag',
                'dager',
            )} på topp. ${visningsnavn(a.nyLeder)} fører nå an med ${a.luke} poeng.`,
            `Og der raknet det for ${visningsnavn(a.gammelLeder)} etter ${a.dager} ${flertall(
                a.dager,
                'dag',
                'dager',
            )} i tet! ${visningsnavn(a.nyLeder)} har tatt over og leder med ${a.luke} poeng. 🔥`,
        ],
        a.frø,
    )
    return { accent: 'gold', tittel, body }
}

export interface LederHolderArgs {
    leder: string
    luke: string
    dager: number
    // Nærmeste jager (navn) — den som ligger rett bak lederen. null om ingen bak.
    jager: string | null
    frø: number | string
}

const LEDER_HOLDER_TITTEL: ((leder: string) => string)[] = [
    (l) => `${visningsnavn(l)} sitter bom fast på tronen 👑`,
    (l) => `Lederen vakler ikke — ${visningsnavn(l)} fører fortsatt an`,
    (l) => `${visningsnavn(l)} holder unna helt i tet`,
    (l) => `Ingen får has på ${visningsnavn(l)} på topp`,
    (l) => `${visningsnavn(l)} kontrollerer kampen fra tetposisjon`,
]

export function malLederHolder(a: LederHolderArgs): MalResultat {
    const tittel = velgVariant(LEDER_HOLDER_TITTEL, a.frø)(a.leder)
    // Jager-frasen navngir den som puster lederen i nakken — så rapporten handler om
    // mer enn at lederen «holder stand»: hvem er rett bak, og hvor tett er det?
    const jager = a.jager ? visningsnavn(a.jager) : null
    const body = velgVariant(
        [
            `Nok en natt på toppen for ${visningsnavn(a.leder)}, som har ført an ${a.dager} ${flertall(
                a.dager,
                'dag',
                'dager',
            )} på rad og har ${a.luke} poeng ned til ${jager ?? 'neste'}. 💪`,
            `${visningsnavn(a.leder)} ga seg ikke i natt heller — ${a.dager} ${flertall(
                a.dager,
                'dag',
                'dager',
            )} sammenhengende i tet${jager ? `, og ${jager} puster ${a.luke} poeng bak` : `, ${a.luke} poeng klar`}.`,
            `Rutinert ledelse fra ${visningsnavn(a.leder)}, som holder unna ${a.dager} ${flertall(
                a.dager,
                'dag',
                'dager',
            )} på rad${jager ? `. ${jager} jager ${a.luke} poeng bak.` : ` med ${a.luke} poengs luke.`} 👑`,
        ],
        a.frø,
    )
    return { accent: 'gold', tittel, body }
}

// Delt ledelse: det står likt på toppen (to eller flere deler 1.-plass). Dette er
// IKKE et lederbytte — selv om rå-sorteringen tilfeldigvis legger en annen øverst,
// har ingen gått forbi noen. Egen «dødt løp»-vinkling så vi aldri skriver «leder
// med 0 poeng».
export interface DeltLedelseArgs {
    // Alle som deler 1.-plass (visningsklare navn, i tabellrekkefølge).
    ledere: string[]
    // Den delte toppsummen.
    poeng: number
    // De som klatret opp i delt ledelse siden i går (tom = toppen sto allerede delt).
    nyeUtfordrere: string[]
    // Gårsdagens (sole) leder, hvis fremdeles på topp — den som ble innhentet.
    forrigeLeder: string | null
    // Antall dager forrige leder satt på topp før de fikk selskap.
    dager: number
    frø: number | string
}

const DELT_LEDELSE_TITTEL: string[] = [
    'Dødt løp i toppen! 🤝',
    'Delt ledelse — ingen vil gi seg en tomme',
    'Skulder ved skulder helt i tet 🔝',
    'Maktkamp på topp: det skilles ikke et poeng',
    'Tronstrid! Flere deler ledelsen',
]

export function malDeltLedelse(a: DeltLedelseArgs): MalResultat {
    const tittel = velgVariant(DELT_LEDELSE_TITTEL, a.frø)
    const ledereTekst = listeMedOg(a.ledere.map(visningsnavn))
    const poeng = formatLuke(a.poeng)

    let body: string
    if (a.nyeUtfordrere.length === 1 && a.forrigeLeder) {
        const utfordrer = visningsnavn(a.nyeUtfordrere[0])
        const leder = visningsnavn(a.forrigeLeder)
        const dagerTekst = `${a.dager} ${flertall(a.dager, 'dag', 'dager')}`
        body = velgVariant(
            [
                `${utfordrer} har tatt igjen ${leder} på topp — begge står med ${poeng}. ${leder} ledet alene i ${dagerTekst} før dette. Nå er det åpent igjen! 🔥`,
                `Innhentet! ${utfordrer} kontret seg helt opp i delt ledelse med ${leder}, og det står ${poeng} på begge i teten. Ikke en luke å gå på.`,
                `For et comeback av ${utfordrer}, som har spist opp hele forspranget til ${leder}! Begge står med ${poeng} etter at ${leder} ledet alene i ${dagerTekst}. Nervepirrende!`,
            ],
            a.frø,
        )
    } else {
        body = velgVariant(
            [
                `${ledereTekst} står helt likt på topp med ${poeng} hver. Ingen luke i teten — her avgjøres alt på neste kampdag. 🔥`,
                `Tett som hagl i toppen: ${ledereTekst} deler tetposisjonen på ${poeng}. Marginene rår.`,
                `Maktkamp uten vinner foreløpig: ${ledereTekst} deler ledelsen på ${poeng} hver. Her skilles det ikke et poeng. 🤝`,
            ],
            a.frø,
        )
    }
    return { accent: 'gold', tittel, body }
}
