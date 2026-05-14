import { startTestStack, TestStack } from '../support/testStack'

// Kjøres én gang før integrasjonstestene. Starter test-stacken og eksponerer
// adresser via process.env (propageres til jest-workerne) — selve handlene
// lagres på globalThis for teardown.
export default async function globalSetup(): Promise<void> {
    const stack = await startTestStack()
    ;(globalThis as unknown as { __TEST_STACK__: TestStack }).__TEST_STACK__ = stack
    process.env.TEST_BASE_URL = stack.baseUrl
    process.env.TEST_DB_URL = stack.dbUrl
}
