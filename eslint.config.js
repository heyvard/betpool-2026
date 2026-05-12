const nextCoreWebVitals = require('eslint-config-next/core-web-vitals')
const unusedImports = require('eslint-plugin-unused-imports')

module.exports = [
    { ignores: ['migrations/**'] },
    ...nextCoreWebVitals,
    {
        plugins: {
            'unused-imports': unusedImports,
        },
        rules: {
            'no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'warn',
                { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
            ],
        },
    },
]
