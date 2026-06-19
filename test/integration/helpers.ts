// API-hjelpere for integrasjonstestene. DB-hjelperne (withDb/seedUser/truncateAll)
// ligger i ../support/db og re-eksporteres her for å holde testfilene ryddige.
export { withDb, truncateAll, seedUser, seedPlayer, førsteMatchNum } from '../support/db'

const baseUrl = () => {
    const url = process.env.TEST_BASE_URL
    if (!url) throw new Error('TEST_BASE_URL er ikke satt — kjørte globalSetup?')
    return url
}

interface ApiOpts {
    user?: string // verdi for «x-test-user»-headeren (firebase_user_id)
    method?: string
    body?: unknown
    cookieUser?: string // alternativt: send identitet som «betpool_test_user»-cookie
    clock?: string // ISO-streng for betpool_test_clock-cookie — overstyrer serverNå()
}

export async function api(path: string, opts: ApiOpts = {}): Promise<Response> {
    const headers: Record<string, string> = {}
    if (opts.user) headers['x-test-user'] = opts.user
    const cookies: string[] = []
    if (opts.cookieUser) cookies.push(`betpool_test_user=${encodeURIComponent(opts.cookieUser)}`)
    if (opts.clock) cookies.push(`betpool_test_clock=${encodeURIComponent(opts.clock)}`)
    if (cookies.length > 0) headers['cookie'] = cookies.join('; ')
    // Bevisst ingen content-type: handlerne gjør JSON.parse(req.body) og
    // forventer en streng (Next.js parser bare JSON ved application/json).
    return fetch(`${baseUrl()}${path}`, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
}
