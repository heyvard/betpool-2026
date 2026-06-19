'use strict'

// users.topscorer_forrige_player_id — strukturert «forrige toppscorer» for endre-
// vinduet (bytte av toppscorer med halvering av poeng). Peker til en rad i `players`
// (football-data sin spiller-id), på samme måte som topscorer_player_id. Erstatter
// fritekst-kolonnen topscorer_forrige som kilde for ny logikk; selve fritekst-kolonnen
// beholdes i databasen.
//
// CockroachDB liker dårlig å blande DDL med DML i transaksjon; players-/player_id-
// migreringene kjørte også uten transaksjon, så vi følger samme mønster her.
exports.config = { transaction: false }

exports.up = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.integer('topscorer_forrige_player_id').nullable().references('players.id')
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.dropColumn('topscorer_forrige_player_id')
    })
}
