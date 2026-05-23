'use strict'

// Private ligaer. Hovedligaen (alle aktive brukere) er fortsatt implisitt og har
// ingen rad her — `leagues` holder bare de private ligaene. En privat liga er ren
// visningsfiltrering: poengene er de samme som i hovedligaen, ligaen bestemmer
// bare hvem som vises sammen. `innsats`/`betalingsinfo` er ren informasjon som
// eieren setter; eieren sporer innbetaling manuelt via `league_members.paid`.
exports.up = async (knex) => {
    await knex.schema.createTable('leagues', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.text('name').notNullable()
        t.uuid('owner_user_id').notNullable().references('users.id')
        t.integer('innsats').nullable()
        t.text('betalingsinfo').nullable()
        t.timestamps(false, true)
    })

    // Ett medlemskap per (liga, bruker). `status` skiller en åpen invitasjon fra
    // et bekreftet medlem; takker man nei slettes raden helt. `paid` er om
    // medlemmet har betalt nettopp denne ligaens innsats.
    await knex.schema.createTable('league_members', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.uuid('league_id').notNullable().references('leagues.id').onDelete('CASCADE')
        t.uuid('user_id').notNullable().references('users.id')
        t.text('status').notNullable().defaultTo('invitert') // 'invitert' | 'medlem'
        t.boolean('paid').notNullable().defaultTo(false)
        t.timestamps(false, true)
        t.unique(['league_id', 'user_id'])
        t.index(['user_id'])
    })
}

exports.down = async (knex) => {
    await knex.schema.dropTable('league_members')
    await knex.schema.dropTable('leagues')
}
