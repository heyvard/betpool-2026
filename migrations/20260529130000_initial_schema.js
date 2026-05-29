'use strict'

// Konsolidert initialschema. Erstatter hele migreringshistorikken: databasen ble
// nullstilt (alle tabeller droppet, inkludert knex_migrations), så denne ene
// migreringen bygger skjemaet i sin endelige tilstand. Tidligere var dette ~17
// separate migreringer (users → bets → chat → match_scores → leagues → … +
// diverse ALTER-er); de er slått sammen her for å være lettere å lese.
//
// CockroachDB liker dårlig å blande mange DDL-operasjoner med DML (seedingen av
// `matches`) i samme transaksjon, så vi kjører uten transaksjon — trygt nok mot
// en fersk database.
exports.config = { transaction: false }

const fixtures = require('../src/data/footballDataFixtures.json')

// football-data bruker URY for Uruguay; resten av appen bruker URU.
function normaliserTla(tla) {
    if (!tla) return ''
    return tla === 'URY' ? 'URU' : tla
}

function stageTilRunde(stage, matchday) {
    switch (stage) {
        case 'GROUP_STAGE':
            return matchday ?? 1
        case 'LAST_32':
            return 4
        case 'LAST_16':
            return 5
        case 'QUARTER_FINALS':
            return 6
        case 'SEMI_FINALS':
            return 7
        case 'THIRD_PLACE':
            return 8
        case 'FINAL':
            return 9
        default:
            return 1
    }
}

function gruppeTilTekst(group) {
    if (!group) return null
    return `Group ${group.replace('GROUP_', '')}`
}

exports.up = async (knex) => {
    // users — kjernebrukeren med rolle-flagg, betalings-/vinner-tipp og preferanser.
    await knex.schema.createTable('users', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.string('firebase_user_id').unique().notNullable()
        t.string('picture').nullable()
        t.boolean('active').notNullable()
        t.string('email').unique().notNullable()
        t.string('name').notNullable()
        t.boolean('scoreadmin').notNullable()
        t.boolean('paymentadmin').notNullable()
        t.boolean('superadmin').notNullable()
        t.boolean('paid').notNullable()
        t.string('winner').notNullable()
        t.string('topscorer').nullable()
        t.boolean('notif_general').notNullable().defaultTo(true)
        t.boolean('notif_reminders').notNullable().defaultTo(true)
        t.boolean('notif_summary').notNullable().defaultTo(true)
        t.timestamp('onboarded_at').nullable()
        t.string('language', 5).notNullable().defaultTo('no')
        t.boolean('winner_endret').notNullable().defaultTo(false)
        t.boolean('topscorer_endret').notNullable().defaultTo(false)
        t.timestamps(false, true)
    })

    // bets — ett tipp per (bruker, kamp). Begge scorene er påkrevd. `joker` dobler
    // kamppoengene; «én joker per runde» håndheves i API-et.
    await knex.schema.createTable('bets', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.uuid('user_id').notNullable().references('users.id')
        t.integer('match_num').notNullable()
        t.integer('home_score').notNullable()
        t.integer('away_score').notNullable()
        t.boolean('joker').notNullable().defaultTo(false)
        t.timestamps(false, true)
        t.unique(['user_id', 'match_num'])
        t.index(['match_num'], 'bets_match_num_idx')
    })

    // chat — global meldingstråd.
    await knex.schema.createTable('chat', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.uuid('user_id').notNullable().references('users.id')
        t.text('message')
        t.timestamps(false, true)
        t.index(['created_at'], 'chat_created_at_idx')
    })

    // match_scores — faktisk resultat + team-override per kamp (manuell sannhet,
    // settes av scoreadmin). Røres ikke av kamp-synken.
    await knex.schema.createTable('match_scores', (t) => {
        t.integer('match_num').primary()
        t.integer('home_score').nullable()
        t.integer('away_score').nullable()
        t.string('home_team_override').nullable()
        t.string('away_team_override').nullable()
        t.timestamps(false, true)
    })

    // push_subscriptions — web push, én rad per enhet. `endpoint` er unik.
    await knex.schema.createTable('push_subscriptions', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.uuid('user_id').notNullable().references('users.id')
        t.text('endpoint').notNullable().unique()
        t.text('p256dh').notNullable()
        t.text('auth').notNullable()
        t.timestamps(false, true)
        t.index(['user_id'], 'push_subscriptions_user_id_idx')
    })

    // audit_log — append-only revisjonslogg for endringer på bet/resultat/bruker.
    await knex.schema.createTable('audit_log', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.timestamp('ts').notNullable().defaultTo(knex.fn.now())
        t.uuid('actor_user_id').notNullable().references('users.id')
        t.text('entity').notNullable() // 'bet' | 'match_score' | 'user'
        t.text('entity_key').notNullable()
        t.text('action').notNullable()
        t.jsonb('old_value').nullable()
        t.jsonb('new_value').nullable()
        t.index(['entity', 'entity_key'])
    })

    // leagues — private ligaer (visningsfiltrering + premiefordeling). `deleted_at`
    // gir soft delete.
    await knex.schema.createTable('leagues', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.text('name').notNullable()
        t.uuid('owner_user_id').notNullable().references('users.id')
        t.integer('innsats').nullable()
        t.text('betalingsinfo').nullable()
        t.integer('premie_forste_prosent').notNullable().defaultTo(0)
        t.integer('premie_andre_prosent').notNullable().defaultTo(0)
        t.integer('premie_tredje_prosent').notNullable().defaultTo(0)
        t.timestamp('deleted_at', { useTz: true }).nullable().defaultTo(null)
        t.timestamps(false, true)
    })

    // league_members — ett medlemskap per (liga, bruker). `status` skiller
    // invitasjon fra bekreftet medlem; `paid` er betaling for denne ligaen.
    await knex.schema.createTable('league_members', (t) => {
        t.uuid('id').default(knex.raw('gen_random_uuid()')).primary()
        t.uuid('league_id').notNullable().references('leagues.id').onDelete('CASCADE')
        t.uuid('user_id').notNullable().references('users.id')
        t.text('status').notNullable().defaultTo('invitert') // 'invitert' | 'medlem'
        t.boolean('paid').notNullable().defaultTo(false)
        t.timestamps(false, true)
        t.unique(['league_id', 'user_id'])
        t.index(['user_id'])
    })

    // matches — kampoppsettet, seedet fra football-data og holdt oppdatert av
    // sync-cronen (src/server/syncMatches.ts). `status` er kampstatus fra
    // football-data (TIMED/IN_PLAY/PAUSED/FINISHED osv.).
    await knex.schema.createTable('matches', (t) => {
        t.integer('match_num').primary() // football-data sin match-id
        t.integer('round').notNullable()
        t.string('home_team').nullable() // tla; tom/null i sluttspill til avgjort
        t.string('away_team').nullable()
        t.timestamp('game_start', { useTz: true }).notNullable()
        t.string('group').nullable()
        t.string('stage').nullable()
        t.string('status').notNullable().defaultTo('TIMED')
        t.timestamp('synced_at', { useTz: true }).defaultTo(knex.fn.now())
    })

    const rader = fixtures.matches.map((m) => {
        const home = normaliserTla(m.homeTeam && m.homeTeam.tla)
        const away = normaliserTla(m.awayTeam && m.awayTeam.tla)
        return {
            match_num: m.id,
            round: stageTilRunde(m.stage, m.matchday),
            home_team: home || null,
            away_team: away || null,
            game_start: m.utcDate,
            group: gruppeTilTekst(m.group),
            stage: m.stage,
            status: m.status || 'TIMED',
        }
    })
    await knex('matches').insert(rader)
}

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists('matches')
    await knex.schema.dropTableIfExists('league_members')
    await knex.schema.dropTableIfExists('leagues')
    await knex.schema.dropTableIfExists('audit_log')
    await knex.schema.dropTableIfExists('push_subscriptions')
    await knex.schema.dropTableIfExists('match_scores')
    await knex.schema.dropTableIfExists('chat')
    await knex.schema.dropTableIfExists('bets')
    await knex.schema.dropTableIfExists('users')
}
