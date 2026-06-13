'use strict'

exports.config = { transaction: false }

// group_standings — gruppetabellene (stillingen) for gruppespillet, synket fra
// football-data.org sitt /standings-endepunkt (src/server/syncStandings.ts).
// Én rad per lag per gruppe. `group` lagres på samme format som matches."group"
// ("Group A"), og `team_tla` er normalisert (URY → URU) som ellers i appen.
exports.up = async (knex) => {
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

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists('group_standings')
}
