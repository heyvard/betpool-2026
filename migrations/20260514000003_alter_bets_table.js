'use strict'

exports.up = async (knex) => {
    await knex.schema.table('bets', (t) => {
        t.dropForeign(['match_id'])
    })
    await knex.schema.table('bets', (t) => {
        t.dropColumn('match_id')
        t.integer('match_num').nullable()
    })
}

exports.down = async (knex) => {
    await knex.schema.table('bets', (t) => {
        t.dropColumn('match_num')
        t.uuid('match_id').nullable().references('matches.id')
    })
}
