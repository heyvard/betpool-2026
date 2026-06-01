'use strict'

// invite_token gir hver liga en opak, delbar invitasjonslenke (/bli-med/<token>).
// Den volatile defaulten gjør at eksisterende ligaer backfilles med en unik
// 32-tegns hex-token i samme steg.
exports.up = async (knex) => {
    await knex.schema.alterTable('leagues', (t) => {
        t.text('invite_token').notNullable().defaultTo(knex.raw(`replace(gen_random_uuid()::text, '-', '')`))
    })
    await knex.schema.alterTable('leagues', (t) => {
        t.unique(['invite_token'])
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('leagues', (t) => {
        t.dropUnique(['invite_token'])
    })
    await knex.schema.alterTable('leagues', (t) => {
        t.dropColumn('invite_token')
    })
}
