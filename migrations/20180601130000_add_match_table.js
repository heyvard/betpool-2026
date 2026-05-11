'use strict'

exports.up = async (knex) => {
    await knex.schema.createTable('matches', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.integer('match_number').notNullable()
        t.integer('round').notNullable()
        t.string('home_team').notNullable()
        t.string('away_team').notNullable()
        t.integer('home_score').nullable()
        t.integer('away_score').nullable()
        t.timestamp('game_start').notNullable()
        t.timestamps(false, true)
    })
}

exports.down = async function down(knex) {
    await knex.schema.dropTable('matches')
}
