'use strict'

// users.topscorer_player_id — strukturert toppscorer-tipp som peker til en rad i
// `players` (football-data sin spiller-id). Den gamle fritekst-kolonnen `topscorer`
// (brukerens egen tekst) beholdes som kilde; en superadmin går gjennom alle brukere
// i /toppscorer-fiks og kobler fritekst → rett spiller. Nullable: ufiksede brukere
// har null her til de er gått gjennom.
//
// CockroachDB liker dårlig å blande DDL med DML i transaksjon; players-migreringen
// kjørte også uten transaksjon, så vi følger samme mønster her.
exports.config = { transaction: false }

exports.up = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.integer('topscorer_player_id').nullable().references('players.id')
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.dropColumn('topscorer_player_id')
    })
}
