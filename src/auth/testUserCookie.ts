// Cookie-håndtering for test-auth-modus. Cookien bærer hvilken bruker man «er»
// og sendes automatisk til /api/v1/* både fra nettleseren og fra Playwright.
const COOKIE = 'betpool_test_user'

export function readTestUser(): string | undefined {
    if (typeof document === 'undefined') return undefined
    const m = document.cookie.match(/(?:^|;\s*)betpool_test_user=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : undefined
}

export function setTestUser(firebaseUserId: string) {
    document.cookie = `${COOKIE}=${encodeURIComponent(firebaseUserId)}; path=/; max-age=31536000`
}

export function clearTestUser() {
    document.cookie = `${COOKIE}=; path=/; max-age=0`
}
