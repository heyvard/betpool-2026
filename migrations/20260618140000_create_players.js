'use strict'

// players — katalog over alle spillerne i VM-truppene, hentet fra football-data.org
// (/v4/competitions/WC/teams → teams[].squad[]) av synken i src/server/syncPlayers.ts.
// Grunnlag for senere strukturert toppscorer-funksjonalitet. `id` er football-data
// sin spiller-id. Laget identifiseres med tre-bokstavskoden (tla, normalisert URY→URU),
// likt resten av appen.
exports.config = { transaction: false }

exports.up = async (knex) => {
    await knex.schema.createTable('players', (t) => {
        t.integer('id').primary() // football-data sin spiller-id
        t.string('name').notNullable()
        t.string('first_name').nullable()
        t.string('last_name').nullable()
        t.string('position').nullable()
        t.date('date_of_birth').nullable()
        t.string('nationality').nullable()
        t.integer('shirt_number').nullable()
        t.string('team_tla').notNullable() // normalisert tla
        t.integer('team_id').nullable() // football-data sin lag-id
        t.string('team_name').nullable()
        t.timestamp('synced_at', { useTz: true }).defaultTo(knex.fn.now())
        t.index(['team_tla'], 'players_team_tla_idx')
    })
}

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists('players')
}
