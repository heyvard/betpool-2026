import { startTestStack, stopTestStack } from '../support/testStack'

// Playwright kjører denne én gang. Den returnerte funksjonen brukes som teardown.
export default async function globalSetup() {
    const stack = await startTestStack()
    process.env.TEST_BASE_URL = stack.baseUrl
    process.env.TEST_DB_URL = stack.dbUrl
    return async () => {
        await stopTestStack(stack)
    }
}
