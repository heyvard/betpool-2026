'use strict'

// feedback — tilbakemeldinger/kontakt fra brukere. Én rad per innsendt melding.
// `behandlet_at`/`behandlet_av` settes når en superadmin markerer den som
// behandlet i superadmin-visningen.
exports.up = async (knex) => {
    await knex.schema.createTable('feedback', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.uuid('user_id').notNullable().references('users.id')
        t.text('message').notNullable()
        t.timestamp('behandlet_at').nullable()
        t.uuid('behandlet_av').nullable().references('users.id')
        t.timestamps(false, true)
        t.index(['created_at'], 'feedback_created_at_idx')
    })
}

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists('feedback')
}
