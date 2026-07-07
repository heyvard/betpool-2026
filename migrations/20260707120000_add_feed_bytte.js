// CockroachDB liker dårlig å blande DDL (kolonne + FK + indeks) i én transaksjon
// — se topscorer_player_id- og create_feed-migreringene for samme mønster.
exports.config = { transaction: false }

exports.up = async (knex) => {
    await knex.schema.alterTable('feed_posts', (t) => {
        t.uuid('subject_user_id').nullable().references('users.id')
        t.text('bytte_type').nullable() // 'vinner' | 'toppscorer', kun for kind='bytte'
    })
    // Idempotent: samme bruker kan ikke få to bytte-poster av samme type
    // (de har jo bare ett bytte hver uansett, men beskytter mot dobbel-synk).
    await knex.raw(`
        CREATE UNIQUE INDEX feed_posts_bytte_unik_idx
        ON feed_posts (subject_user_id, bytte_type)
        WHERE kind = 'bytte'
    `)
}

exports.down = async (knex) => {
    await knex.raw(`DROP INDEX IF EXISTS feed_posts_bytte_unik_idx`)
    await knex.schema.alterTable('feed_posts', (t) => {
        t.dropColumn('subject_user_id')
        t.dropColumn('bytte_type')
    })
}
