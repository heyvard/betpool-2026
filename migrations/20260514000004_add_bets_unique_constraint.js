'use strict'

exports.up = async (knex) => {
    await knex.schema.table('bets', (t) => {
        t.unique(['user_id', 'match_num'])
    })
}

exports.down = async (knex) => {
    await knex.schema.table('bets', (t) => {
        t.dropUnique(['user_id', 'match_num'])
    })
}
