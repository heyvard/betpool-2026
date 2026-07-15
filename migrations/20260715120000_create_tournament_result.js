'use strict'

exports.config = { transaction: false }

// tournament_result / tournament_topscorers — den faktiske VM-fasiten (motstykke
// til users.winner/topscorer_player_id, som er BRUKERNES tips). Fasiten var
// hardkodet i winner.ts/topscorer.ts; disse slettes til fordel for disse to
// tabellene, satt via /api/v1/admin/tournament-result (superadmin).
//
// tournament_result er singleton-mønsteret fra sync_state (én rad, id =
// 'current'). tournament_topscorers er et sett — spillerne som offisielt
// deler toppscorer-tittelen; player_id er nøkkelen, insert/delete er selve
// "legg til/fjern medvinner"-operasjonen.
//
// CockroachDB liker dårlig å blande DDL med DML i transaksjon; players-/
// sync_state-migreringene kjørte også uten transaksjon, så vi følger samme
// mønster her.
exports.up = async (knex) => {
    await knex.schema.createTable('tournament_result', (t) => {
        t.text('id').primary()
        t.string('winner_team_tla').nullable()
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
    await knex('tournament_result').insert({ id: 'current', winner_team_tla: null })

    await knex.schema.createTable('tournament_topscorers', (t) => {
        t.integer('player_id').primary().references('players.id')
    })
}

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists('tournament_topscorers')
    await knex.schema.dropTableIfExists('tournament_result')
}
