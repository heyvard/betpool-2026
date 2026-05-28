'use strict'

// Tre indekser som mangler basert på faktiske spørringsmønstre:
//
// 1. bets(match_num): reminders.ts gjør WHERE match_num = ANY($1::int[]) over
//    hele tabellen. UNIQUE(user_id, match_num) har user_id som ledende kolonne
//    og dekker ikke dette søket.
//
// 2. push_subscriptions(user_id): push.ts gjør WHERE user_id = $1 for alle
//    brukere ved utsending av push-varsler. Ingen indeks på user_id i dag.
//
// 3. chat(created_at): eneste lesespørring på chat er full-tabell med
//    ORDER BY created_at ASC. En indeks eliminerer sort-steget.
//
// CREATE INDEX CONCURRENTLY kan ikke kjøre i en transaksjon (CockroachDB).
exports.config = { transaction: false }

exports.up = async (knex) => {
    await knex.raw(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS bets_match_num_idx
         ON bets (match_num)`,
    )
    await knex.raw(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS push_subscriptions_user_id_idx
         ON push_subscriptions (user_id)`,
    )
    await knex.raw(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS chat_created_at_idx
         ON chat (created_at ASC)`,
    )
}

exports.down = async (knex) => {
    await knex.raw(`DROP INDEX IF EXISTS bets_match_num_idx`)
    await knex.raw(`DROP INDEX IF EXISTS push_subscriptions_user_id_idx`)
    await knex.raw(`DROP INDEX IF EXISTS chat_created_at_idx`)
}
