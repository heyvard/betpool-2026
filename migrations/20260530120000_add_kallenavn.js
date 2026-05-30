'use strict'

exports.up = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.string('kallenavn').nullable()
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.dropColumn('kallenavn')
    })
}
