'use strict'

// Per-bruker preferanser for hvilke push-varsler man vil ha. Default på for
// alle tre — eksisterende brukere som allerede har abonnert beholder
// dagens oppførsel (de fikk reminders før, fortsetter å få dem).
exports.up = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.boolean('notif_general').notNullable().defaultTo(true)
        t.boolean('notif_reminders').notNullable().defaultTo(true)
        t.boolean('notif_summary').notNullable().defaultTo(true)
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.dropColumn('notif_general')
        t.dropColumn('notif_reminders')
        t.dropColumn('notif_summary')
    })
}
