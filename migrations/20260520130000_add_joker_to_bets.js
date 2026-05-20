'use strict'

// Joker: hver bruker kan markere én kamp per runde der kamppoengene dobles.
// Flagget bor på selve bet-raden; «én joker per runde»-regelen håndheves i API-et
// (src/pages/api/v1/me/bets/[id]/joker.ts).
exports.up = async (knex) => {
    await knex.schema.alterTable('bets', (t) => {
        t.boolean('joker').notNullable().defaultTo(false)
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('bets', (t) => {
        t.dropColumn('joker')
    })
}
