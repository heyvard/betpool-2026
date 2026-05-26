'use strict'

// Når brukeren har fullført (eller hoppet over) onboarding-overlay-en
// settes onboarded_at. Eksisterende brukere skal ikke se overlay-en, så
// vi backfiller dem med created_at i samme operasjon.
exports.up = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.timestamp('onboarded_at').nullable()
    })
    await knex.raw('UPDATE users SET onboarded_at = created_at WHERE onboarded_at IS NULL')
}

exports.down = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.dropColumn('onboarded_at')
    })
}
