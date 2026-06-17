'use strict'

exports.config = { transaction: false }

// sync_state — delt throttle-tilstand for den hyppige, klient-trigget
// live-synken fra football-data.org. Én enkelt rad (id = 'live') holder
// tidspunktet for siste synk-forsøk, slik at /api/v1/matches kan claime et
// synk-slot atomisk og garantere maks ett football-data-kall per 15s-vindu på
// tvers av alle serverless-instanser. Se src/pages/api/v1/matches.ts.
exports.up = async (knex) => {
    await knex.schema.createTable('sync_state', (t) => {
        t.text('id').primary()
        t.timestamp('live_synced_at', { useTz: true }).notNullable()
    })
    // Seed med et gammelt tidspunkt så første poll synker umiddelbart.
    await knex('sync_state').insert({ id: 'live', live_synced_at: new Date(0) })
}

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists('sync_state')
}
