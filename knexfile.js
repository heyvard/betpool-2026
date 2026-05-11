module.exports = {
    client: 'pg',
    connection: process.env.POSTGRES_URL_NON_POOLING,
    migrations: {
        directory: './migrations',
    },
}
