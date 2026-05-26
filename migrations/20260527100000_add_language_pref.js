'use strict'

exports.up = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.string('language', 5).notNullable().defaultTo('no')
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.dropColumn('language')
    })
}
