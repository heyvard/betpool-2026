// Egen jest-konfig for API-integrasjonstester. Disse kjører mot en lokal
// `next dev` + Postgres i testcontainers (se test/support/testStack.ts).
// Holdt adskilt fra enhetstestene (jest.config.js) som kjører i jsdom.
module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/test/integration/**/*.integration.test.ts'],
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
    },
    transformIgnorePatterns: ['/node_modules/'],
    globalSetup: '<rootDir>/test/integration/globalSetup.ts',
    globalTeardown: '<rootDir>/test/integration/globalTeardown.ts',
    testTimeout: 30000,
}
