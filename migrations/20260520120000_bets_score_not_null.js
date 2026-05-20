'use strict'

// Et bet gir bare mening når begge lagene har en score. Fjern halvferdige/tomme
// rader og gjør kolonnene påkrevd så de ikke kan lagres som null igjen.
// Kjøres uten transaksjon: CockroachDB liker dårlig DML (DELETE) og DDL (ALTER)
// i samme transaksjon.
exports.config = { transaction: false }

exports.up = async (knex) => {
    await knex.raw('DELETE FROM bets WHERE home_score IS NULL OR away_score IS NULL')
    await knex.raw('ALTER TABLE bets ALTER COLUMN home_score SET NOT NULL')
    await knex.raw('ALTER TABLE bets ALTER COLUMN away_score SET NOT NULL')
}

exports.down = async (knex) => {
    await knex.raw('ALTER TABLE bets ALTER COLUMN home_score DROP NOT NULL')
    await knex.raw('ALTER TABLE bets ALTER COLUMN away_score DROP NOT NULL')
}
