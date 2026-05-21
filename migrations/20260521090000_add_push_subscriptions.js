'use strict'

// Web push-abonnement. Én rad per nettleser/enhet — en bruker kan ha flere.
// «endpoint» er unik; samme enhet som re-abonnerer oppdaterer sin egen rad.
exports.up = async (knex) => {
    await knex.schema.createTable('push_subscriptions', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.uuid('user_id').notNullable().references('users.id')
        t.text('endpoint').notNullable().unique()
        t.text('p256dh').notNullable()
        t.text('auth').notNullable()
        t.timestamps(false, true)
    })
}

exports.down = async (knex) => {
    await knex.schema.dropTable('push_subscriptions')
}
