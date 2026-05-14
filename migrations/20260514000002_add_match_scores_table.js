'use strict'

exports.up = async (knex) => {
    await knex.schema.createTable('match_scores', (t) => {
        t.integer('match_num').primary()
        t.integer('home_score').nullable()
        t.integer('away_score').nullable()
        t.string('home_team_override').nullable()
        t.string('away_team_override').nullable()
        t.timestamps(false, true)
    })
}

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists('match_scores')
}
