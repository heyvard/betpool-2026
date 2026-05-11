'use strict'

exports.up = async (knex) => {
    await knex.schema.createTable('users', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.string('firebase_user_id').unique().notNullable()
        t.string('picture').nullable()
        t.boolean('active').notNullable()
        t.string('email').unique().notNullable()
        t.string('name').notNullable()
        t.boolean('scoreadmin').notNullable()
        t.boolean('paymentadmin').notNullable()
        t.boolean('superadmin').notNullable()
        t.boolean('paid').notNullable()
        t.string('winner').notNullable()
        t.string('topscorer').nullable()
        t.timestamps(false, true)
    })
}

exports.down = async function down(knex) {
    await knex.schema.dropTable('users')
}
