'use strict'

// Append-only revisjonslogg. Hver endring på et bet, et resultat (match_scores)
// eller et bruker-flagg skrives som en ny rad her og oppdateres aldri. Lar oss
// ettergå historikken hvis noen klager på at et tipp, en joker eller et
// resultat ble endret. «actor_user_id» er hvem som utførte endringen — for et
// bet er det brukeren selv, for resultater/bruker-flagg er det en admin.
exports.up = async (knex) => {
    await knex.schema.createTable('audit_log', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.timestamp('ts').notNullable().defaultTo(knex.fn.now())
        t.uuid('actor_user_id').notNullable().references('users.id')
        t.text('entity').notNullable() // 'bet' | 'match_score' | 'user'
        t.text('entity_key').notNullable()
        t.text('action').notNullable()
        t.jsonb('old_value').nullable()
        t.jsonb('new_value').nullable()
        t.index(['entity', 'entity_key'])
    })
}

exports.down = async (knex) => {
    await knex.schema.dropTable('audit_log')
}
