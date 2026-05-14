'use strict'

exports.up = async (knex) => {
    await knex.schema.createTable('bets', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.uuid('user_id').notNullable().references('users.id')
        t.integer('match_num').notNullable()
        t.integer('home_score').nullable()
        t.integer('away_score').nullable()
        t.timestamps(false, true)
        t.unique(['user_id', 'match_num'])
    })
}

exports.down = async function down(knex) {
    await knex.schema.dropTable('bets')
}
