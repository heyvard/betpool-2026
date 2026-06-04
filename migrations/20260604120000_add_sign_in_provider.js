'use strict'

// Hvilken Firebase-innloggingsmetode brukeren brukte sist — lagres fra
// `firebase.sign_in_provider`-claimen i ID-tokenet ved innlogging/registrering.
// Rå Firebase-verdi: «google.com» (Google) eller «password» (e-post/passord).
// Nullable fordi eksisterende brukere ikke har verdi før de logger inn neste gang.
exports.up = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.string('sign_in_provider').nullable()
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.dropColumn('sign_in_provider')
    })
}
