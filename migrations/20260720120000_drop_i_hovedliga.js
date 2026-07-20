'use strict'

exports.up = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.dropColumn('i_hovedliga')
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.boolean('i_hovedliga').notNullable().defaultTo(true)
    })
}
