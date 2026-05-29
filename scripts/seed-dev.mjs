// Seeder testdata i den lokale Docker-Postgres-en for `pnpm dev:test`.
// Kjøres av scripts/dev-test.sh etter migrasjonene. Idempotent
// (ON CONFLICT DO NOTHING), så den kan kjøres på nytt ved hver oppstart.
//
// Kjør manuelt: POSTGRES_URL_NON_POOLING=... node scripts/seed-dev.mjs

import pg from 'pg'

const { Client } = pg

// Admin-bruker — kan redigere resultater/sluttspill/brukere.
const ADMIN = {
    fid: 'test-admin',
    name: 'Test Admin',
    email: 'admin@test.local',
    scoreadmin: true,
    paymentadmin: true,
    superadmin: true,
    paid: true,
    winner: '',
    topscorer: null,
}

// 5 vanlige bettere med varierte mesterskaps-tips.
const BETTERE = [
    {
        fid: 'test-user-1',
        name: 'Anne Bettelin',
        email: 'anne@test.local',
        paid: true,
        winner: 'BRA',
        topscorer: 'Vinicius Junior',
    },
    {
        fid: 'test-user-2',
        name: 'Bjørn Tipster',
        email: 'bjorn@test.local',
        paid: true,
        winner: 'FRA',
        topscorer: 'Kylian Mbappé',
    },
    {
        fid: 'test-user-3',
        name: 'Carl Odds',
        email: 'carl@test.local',
        paid: false,
        winner: 'ARG',
        topscorer: 'Lionel Messi',
    },
    {
        fid: 'test-user-4',
        name: 'Dina Spår',
        email: 'dina@test.local',
        paid: true,
        winner: 'BRA',
        topscorer: 'Kylian Mbappé',
    },
    {
        fid: 'test-user-5',
        name: 'Even Lykke',
        email: 'even@test.local',
        paid: true,
        winner: 'ESP',
        topscorer: 'Lamine Yamal',
    },
]

// Bets på de fem første kampene (kronologisk) for hver betterne, angitt ved
// kamp-indeks 1–5: [kampIndeks, home_score, away_score]. Indeksen mappes til
// faktiske match_num fra `matches`-tabellen ved seeding.
// Bevisst varierte — noen treffer eksakt, noen kun utfall, noen bommer.
const BETS = {
    'test-user-1': [
        [1, 2, 1],
        [2, 1, 0],
        [3, 0, 1],
        [4, 2, 2],
        [5, 0, 0],
    ],
    'test-user-2': [
        [1, 1, 0],
        [2, 0, 0],
        [3, 2, 1],
        [4, 1, 1],
        [5, 2, 1],
    ],
    'test-user-3': [
        [1, 0, 2],
        [2, 1, 1],
        [3, 1, 2],
        [4, 0, 0],
        [5, 1, 1],
    ],
    'test-user-4': [
        [1, 2, 1],
        [2, 0, 0],
        [3, 0, 3],
        [4, 3, 1],
        [5, 2, 2],
    ],
    'test-user-5': [
        [1, 3, 0],
        [2, 2, 2],
        [3, 1, 1],
        [4, 2, 2],
        [5, 0, 1],
    ],
}

// Ferdige resultater for de fem første kampene: [kampIndeks, home_score, away_score].
const RESULTATER = [
    [1, 2, 1],
    [2, 0, 0],
    [3, 1, 2],
    [4, 2, 2],
    [5, 1, 1],
]

async function seedBruker(client, u) {
    await client.query(
        `INSERT INTO users
           (firebase_user_id, name, email, active, scoreadmin, paymentadmin, superadmin, paid, winner, topscorer)
         VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (firebase_user_id) DO NOTHING`,
        [
            u.fid,
            u.name,
            u.email,
            u.scoreadmin ?? false,
            u.paymentadmin ?? false,
            u.superadmin ?? false,
            u.paid,
            u.winner ?? '',
            u.topscorer ?? null,
        ],
    )
}

async function main() {
    const connectionString = process.env.POSTGRES_URL_NON_POOLING
    if (!connectionString) throw new Error('POSTGRES_URL_NON_POOLING er ikke satt')

    const client = new Client({ connectionString })
    await client.connect()
    try {
        await seedBruker(client, ADMIN)
        for (const u of BETTERE) {
            await seedBruker(client, u)
        }

        // Kamp-indeks (1–5) → faktisk match_num for de fem første kampene.
        const kampRader = (await client.query('SELECT match_num FROM matches ORDER BY game_start ASC LIMIT 5')).rows
        const matchNumFor = (indeks) => kampRader[indeks - 1]?.match_num

        for (const [fid, bets] of Object.entries(BETS)) {
            for (const [kampIndeks, home, away] of bets) {
                const matchNum = matchNumFor(kampIndeks)
                if (matchNum == null) continue
                await client.query(
                    `INSERT INTO bets (user_id, match_num, home_score, away_score)
                     SELECT id, $2, $3, $4 FROM users WHERE firebase_user_id = $1
                     ON CONFLICT (user_id, match_num) DO NOTHING`,
                    [fid, matchNum, home, away],
                )
            }
        }

        for (const [kampIndeks, home, away] of RESULTATER) {
            const matchNum = matchNumFor(kampIndeks)
            if (matchNum == null) continue
            await client.query(
                `INSERT INTO match_scores (match_num, home_score, away_score)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (match_num) DO NOTHING`,
                [matchNum, home, away],
            )
        }

        const { rows } = await client.query(
            `SELECT
               (SELECT count(*) FROM users) AS brukere,
               (SELECT count(*) FROM bets) AS bets,
               (SELECT count(*) FROM match_scores) AS resultater`,
        )
        const { brukere, bets, resultater } = rows[0]
        console.log(`[seed-dev] ferdig — ${brukere} brukere, ${bets} bets, ${resultater} resultater i DB`)
    } finally {
        await client.end()
    }
}

main().catch((e) => {
    console.error('[seed-dev] FEIL:', e.message)
    process.exit(1)
})
