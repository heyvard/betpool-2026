'use strict'

exports.config = { transaction: false }

// Dropper group_standings. Gruppetabellene er rent avledet data fra
// football-data.org og brukes ikke i scoring — de hentes nå rett gjennom av
// /api/v1/standings (src/server/hentStandings.ts) med en kort cache, i stedet
// for å synkes til og leses fra databasen.
exports.up = async (knex) => {
    await knex.schema.dropTableIfExists('group_standings')
}

exports.down = async (knex) => {
    await knex.schema.createTable('group_standings', (t) => {
        t.string('group').notNullable() // "Group A"
        t.string('team_tla').notNullable() // tre-bokstavskode, normalisert
        t.integer('position').notNullable()
        t.integer('played').notNullable().defaultTo(0)
        t.integer('won').notNullable().defaultTo(0)
        t.integer('draw').notNullable().defaultTo(0)
        t.integer('lost').notNullable().defaultTo(0)
        t.integer('goals_for').notNullable().defaultTo(0)
        t.integer('goals_against').notNullable().defaultTo(0)
        t.integer('goal_difference').notNullable().defaultTo(0)
        t.integer('points').notNullable().defaultTo(0)
        t.timestamp('synced_at', { useTz: true }).defaultTo(knex.fn.now())
        t.primary(['group', 'team_tla'])
    })
}
