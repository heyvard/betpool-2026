'use strict'

// Premiefordeling i private ligaer. Verten setter prosenter for 1./2./3. plass,
// og appen regner ut kroner per plass: pott = innsats × antall medlemmer, hver
// plass får pott × prosent / 100. Sum av prosentene må være ≤ 100 — overskytende
// går ikke til noen (verten kan ha en buffer / dele ut selv).
exports.up = async (knex) => {
    await knex.schema.alterTable('leagues', (t) => {
        t.integer('premie_forste_prosent').notNullable().defaultTo(0)
        t.integer('premie_andre_prosent').notNullable().defaultTo(0)
        t.integer('premie_tredje_prosent').notNullable().defaultTo(0)
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('leagues', (t) => {
        t.dropColumn('premie_forste_prosent')
        t.dropColumn('premie_andre_prosent')
        t.dropColumn('premie_tredje_prosent')
    })
}
