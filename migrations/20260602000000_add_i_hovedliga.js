'use strict'

// Om brukeren er med i hovedligaen. Default true ⇒ alle eksisterende brukere
// er uendret med. En bruker som meldes inn via en privat-liga-lenke kan velge
// bort hovedligaen; da teller ikke tipsene deres i hovedligaens poengberegning.
exports.up = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.boolean('i_hovedliga').notNullable().defaultTo(true)
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.dropColumn('i_hovedliga')
    })
}
