import { stopTestStack, TestStack } from '../support/testStack'

export default async function globalTeardown(): Promise<void> {
    const stack = (globalThis as unknown as { __TEST_STACK__?: TestStack }).__TEST_STACK__
    if (stack) {
        await stopTestStack(stack)
    }
}
