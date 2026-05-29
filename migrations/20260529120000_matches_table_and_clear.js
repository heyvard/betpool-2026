'use strict'

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
    await knex.schema.createTable('matches', (t) => {
        t.integer('match_num').primary() // football-data sin match-id
        t.integer('round').notNullable()
        t.string('home_team').nullable() // tla; tom/null i sluttspill til avgjort
        t.string('away_team').nullable()
        t.timestamp('game_start', { useTz: true }).notNullable()
        t.string('group').nullable()
        t.string('stage').nullable()
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
        }
    })
    await knex('matches').insert(rader)

    // Vi er ikke live ennå. Nullstill tipp og scores, og vinner/toppscorer-valg
    // siden verdiformatet endres fra lagnavn til tla.
    await knex('bets').del()
    await knex('match_scores').del()
    await knex('users').update({ winner: '', topscorer: null })
}

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists('matches')
}
