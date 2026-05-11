module.exports = {
    client: 'pg',
    connection: process.env.PG_URI,
    migrations: {
        directory: './migrations',
    },
}
