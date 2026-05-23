// Validering og lagring av premie-prosenter for private ligaer. Brukes av både
// opprett- og oppdater-endepunktene.

export interface Prosenter {
    premie_forste_prosent: number
    premie_andre_prosent: number
    premie_tredje_prosent: number
}

const NØKLER: Array<[keyof Prosenter, string]> = [
    ['premie_forste_prosent', '1. plass'],
    ['premie_andre_prosent', '2. plass'],
    ['premie_tredje_prosent', '3. plass'],
]

export const TOMME_PROSENTER: Prosenter = {
    premie_forste_prosent: 0,
    premie_andre_prosent: 0,
    premie_tredje_prosent: 0,
}

export type ProsenterResultat = { ok: true; verdier: Prosenter } | { ok: false; error: string }

// Slår de tre prosent-feltene fra request-body sammen med eventuelle eksisterende
// verdier (PUT) eller tomme defaults (POST). Returnerer feilmelding hvis et felt
// ikke er gyldig (heltall 0..100) eller summen overstiger 100.
export function parseProsenter(body: Record<string, unknown>, current?: Prosenter): ProsenterResultat {
    const verdier: Prosenter = { ...(current ?? TOMME_PROSENTER) }
    for (const [key, label] of NØKLER) {
        if (!(key in body)) continue
        const raw = body[key]
        if (raw === null || raw === '') {
            verdier[key] = 0
            continue
        }
        const n = Number(raw)
        if (!Number.isInteger(n) || n < 0 || n > 100) {
            return { ok: false, error: `${label} må være et heltall mellom 0 og 100` }
        }
        verdier[key] = n
    }
    const sum = verdier.premie_forste_prosent + verdier.premie_andre_prosent + verdier.premie_tredje_prosent
    if (sum > 100) {
        return { ok: false, error: 'Sum av premie-prosenter må være ≤ 100' }
    }
    return { ok: true, verdier }
}
