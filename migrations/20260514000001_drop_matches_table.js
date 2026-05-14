'use strict'

exports.up = async (knex) => {
    await knex.schema.dropTableIfExists('matches')
}

exports.down = async (knex) => {
    await knex.schema.createTable('matches', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.integer('match_number')
        t.integer('round')
        t.string('home_team')
        t.string('away_team')
        t.integer('home_score').nullable()
        t.integer('away_score').nullable()
        t.timestamp('game_start')
        t.timestamps(false, true)
    })
}
