// Tids-hjelpere for feeden, alltid forankret i Europe/Oslo. Vercel-cron kjører i
// UTC, så morgenrapporten må selv sjekke at klokka faktisk er 8 lokalt og regne
// «i går» i norsk tid.

const OSLO = 'Europe/Oslo'

// YYYY-MM-DD for et tidspunkt i Europe/Oslo (en-CA gir nettopp ISO-datoformatet).
export function osloDato(d: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: OSLO,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d)
}

// Timen (0–23) i Europe/Oslo.
export function osloTime(d: Date = new Date()): number {
    const tekst = new Intl.DateTimeFormat('en-GB', {
        timeZone: OSLO,
        hour: '2-digit',
        hour12: false,
    }).format(d)
    return parseInt(tekst, 10)
}

// Gårsdagens Oslo-dato (YYYY-MM-DD) sett fra `d`.
export function osloGårsdagDato(d: Date = new Date()): string {
    const iDag = osloDato(d)
    // Trekk fra et drøyt døgn og les av Oslo-datoen igjen — robust over DST-skifter.
    const tidligere = new Date(new Date(`${iDag}T12:00:00Z`).getTime() - 24 * 60 * 60 * 1000)
    return osloDato(tidligere)
}
