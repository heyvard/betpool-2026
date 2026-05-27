'use strict'

exports.up = async (knex) => {
    await knex.schema.table('users', (t) => {
        t.boolean('winner_endret').notNullable().defaultTo(false)
        t.boolean('topscorer_endret').notNullable().defaultTo(false)
    })
}

exports.down = async (knex) => {
    await knex.schema.table('users', (t) => {
        t.dropColumn('winner_endret')
        t.dropColumn('topscorer_endret')
    })
}
