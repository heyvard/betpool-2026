'use strict'

exports.config = { transaction: false }

// Sluttspillkamper kan avgjøres etter ordinær tid med ekstraomganger eller straffer.
// football-data sender da `regularTime` (90-minutters-resultatet vi tipper på) ved
// siden av `fullTime` (totalen inkl. ekstraomganger/straffer). Vi lagrer den synkede
// ordinær-tid-scoren + hvem som gikk videre (winner) slik at både score-logikken og
// morgenrapporten kan skille tippe-resultatet fra hvem som faktisk vant.
exports.up = async (knex) => {
    await knex.schema.alterTable('match_scores', (t) => {
        t.integer('synced_home_rt').nullable()
        t.integer('synced_away_rt').nullable()
        t.string('synced_winner').nullable()
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('match_scores', (t) => {
        t.dropColumn('synced_home_rt')
        t.dropColumn('synced_away_rt')
        t.dropColumn('synced_winner')
    })
}
