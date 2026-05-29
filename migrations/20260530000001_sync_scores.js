'use strict'

exports.config = { transaction: false }

exports.up = async (knex) => {
    await knex.schema.alterTable('match_scores', (t) => {
        t.integer('synced_home_ft').nullable()
        t.integer('synced_away_ft').nullable()
        t.integer('synced_home_et').nullable()
        t.integer('synced_away_et').nullable()
        t.integer('synced_home_pen').nullable()
        t.integer('synced_away_pen').nullable()
        t.string('synced_duration').nullable()
        t.timestamp('score_synced_at', { useTz: true }).nullable()
        t.boolean('use_manual').notNullable().defaultTo(false)
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('match_scores', (t) => {
        t.dropColumn('synced_home_ft')
        t.dropColumn('synced_away_ft')
        t.dropColumn('synced_home_et')
        t.dropColumn('synced_away_et')
        t.dropColumn('synced_home_pen')
        t.dropColumn('synced_away_pen')
        t.dropColumn('synced_duration')
        t.dropColumn('score_synced_at')
        t.dropColumn('use_manual')
    })
}
