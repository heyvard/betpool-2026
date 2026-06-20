'use strict'

// Feed — en kronologisk strøm av app-genererte hendelser for hovedligaen
// (Æresligaen). To kilder lager poster: kamp-oppsummeringer (én per kamp når den
// synkes til ferdig) og en daglig morgenrapport. Brukere kan reagere med emoji og
// kommentere; kommentarer kan også få reaksjoner. Ingen brukere kan poste selv.
//
// CockroachDB liker dårlig å blande mye DDL i én transaksjon, så vi kjører uten.
exports.config = { transaction: false }

exports.up = async (knex) => {
    // feed_posts — én rad per hendelse. Både ferdig flettet tittel/body (no) og
    // råverdiene (`data`) lagres, slik at feeden kan rendres uten å regne på nytt,
    // men fronten fortsatt kan vise score-blokk / delta-lister / mini-tabell
    // strukturert.
    await knex.schema.createTable('feed_posts', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.text('kind').notNullable() // 'kamp' | 'morgenrapport'
        t.text('scenario').notNullable() // leder_best | leder_bommet | sjeldent | ingen_traff | endring | lederbytte
        t.integer('match_num').nullable() // satt for kind='kamp'
        t.date('dato').nullable() // Europe/Oslo-dato, satt for kind='morgenrapport'
        t.text('accent').notNullable() // 'win' | 'live' | 'gold' | 'stone' | 'royal'
        t.text('tittel').notNullable()
        t.text('body').notNullable()
        t.jsonb('data').notNullable().defaultTo('{}')
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
        // Idempotent for kamp-poster: re-synk lager aldri duplikat. (NULL match_num
        // for morgenrapport regnes som distinkt og kolliderer ikke her.)
        t.unique(['kind', 'scenario', 'match_num'], { indexName: 'feed_posts_kind_scenario_match_idx' })
        t.index(['created_at'], 'feed_posts_created_at_idx')
    })

    // Maks én morgenrapport per Oslo-dato. Partielt unikt så kamp-poster (dato
    // NULL) ikke berøres.
    await knex.raw(`CREATE UNIQUE INDEX feed_posts_morgenrapport_dato_idx ON feed_posts (dato) WHERE dato IS NOT NULL`)

    // feed_reactions — emoji-reaksjon på en post. Én rad per (post, bruker, emoji);
    // toggle håndteres i API-et (insert/delete).
    await knex.schema.createTable('feed_reactions', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.uuid('post_id').notNullable().references('feed_posts.id').onDelete('CASCADE')
        t.uuid('user_id').notNullable().references('users.id')
        t.text('emoji').notNullable()
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
        t.unique(['post_id', 'user_id', 'emoji'], { indexName: 'feed_reactions_unik_idx' })
    })

    // feed_comments — kommentarer på en post.
    await knex.schema.createTable('feed_comments', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.uuid('post_id').notNullable().references('feed_posts.id').onDelete('CASCADE')
        t.uuid('user_id').notNullable().references('users.id')
        t.text('body').notNullable()
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
        t.index(['post_id', 'created_at'], 'feed_comments_post_idx')
    })

    // feed_comment_reactions — emoji-reaksjon på en kommentar.
    await knex.schema.createTable('feed_comment_reactions', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.uuid('comment_id').notNullable().references('feed_comments.id').onDelete('CASCADE')
        t.uuid('user_id').notNullable().references('users.id')
        t.text('emoji').notNullable()
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
        t.unique(['comment_id', 'user_id', 'emoji'], { indexName: 'feed_comment_reactions_unik_idx' })
    })

    // feed_standings_snapshot — daglig øyeblikksbilde av hovedligaens tabell.
    // Brukes av morgenrapporten til å regne plass-endring (Δplass) pålitelig.
    await knex.schema.createTable('feed_standings_snapshot', (t) => {
        t.date('dato').notNullable() // Europe/Oslo-dato snapshotet ble tatt
        t.uuid('user_id').notNullable().references('users.id')
        t.integer('plass').notNullable()
        t.integer('poeng').notNullable()
        t.unique(['dato', 'user_id'], { indexName: 'feed_standings_snapshot_unik_idx' })
    })
}

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists('feed_standings_snapshot')
    await knex.schema.dropTableIfExists('feed_comment_reactions')
    await knex.schema.dropTableIfExists('feed_comments')
    await knex.schema.dropTableIfExists('feed_reactions')
    await knex.schema.dropTableIfExists('feed_posts')
}
