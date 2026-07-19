// Pallen (kind='podium') er en engangs feed-post: superadmin trykker en knapp
// når alle resultater er verifisert, og posten viser topp-3 i hovedligaen +
// en AI-skrevet oppsummering av reisen deres. Samme mønster som
// feed_posts_morgenrapport_dato_idx (create_feed) og feed_posts_bytte_unik_idx
// (add_feed_bytte): et partielt unikt indeks gjør innsettingen idempotent uten
// å røre de andre kind-ene.
exports.config = { transaction: false }

exports.up = async (knex) => {
    await knex.raw(`
        CREATE UNIQUE INDEX feed_posts_podium_unik_idx
        ON feed_posts (kind)
        WHERE kind = 'podium'
    `)
}

exports.down = async (knex) => {
    await knex.raw(`DROP INDEX IF EXISTS feed_posts_podium_unik_idx`)
}
