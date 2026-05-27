'use strict'

exports.config = { transaction: false }

exports.up = async (knex) => {
    await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)')
}

exports.down = async (_knex) => {}
