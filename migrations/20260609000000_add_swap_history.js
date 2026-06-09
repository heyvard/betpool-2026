exports.up = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.string('winner_forrige').nullable()
        t.string('topscorer_forrige').nullable()
    })
}

exports.down = async (knex) => {
    await knex.schema.alterTable('users', (t) => {
        t.dropColumn('winner_forrige')
        t.dropColumn('topscorer_forrige')
    })
}
