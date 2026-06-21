import { PoolClient } from 'pg'

import { visningsnavn } from './maler'

// Henter siste poster i hovedligaens feed (Æresligaen), nyeste først, med
// aggregerte reaksjoner og kommentarer (kommentarer har egne reaksjoner).
// `mine` regnes ut fra `brukerId`. Delt mellom /api/v1/feed og admin-eksporten.

export const FEED_GRENSE = 60

interface PostRow {
    id: string
    kind: string
    scenario: string
    match_num: number | null
    accent: string
    tittel: string
    body: string
    data: unknown
    created_at: string
}

interface ReaksjonRad {
    nøkkel: string
    emoji: string
    antall: string
    mine: boolean
}

interface KommentarRad {
    id: string
    post_id: string
    user_id: string
    body: string
    created_at: string
    name: string
    picture: string | null
}

export interface FeedReaksjon {
    emoji: string
    antall: number
    mine: boolean
}

export interface FeedKommentar {
    id: string
    navn: string
    picture: string | null
    body: string
    created_at: string
    reactions: FeedReaksjon[]
}

export interface FeedPost {
    id: string
    kind: string
    scenario: string
    match_num: number | null
    accent: string
    tittel: string
    body: string
    data: unknown
    created_at: string
    reactions: FeedReaksjon[]
    kommentarAntall: number
    kommentarer: FeedKommentar[]
}

export async function hentFeed(client: PoolClient, brukerId: string, grense = FEED_GRENSE): Promise<FeedPost[]> {
    const postRes = await client.query<PostRow>(
        `SELECT id, kind, scenario, match_num, accent, tittel, body, data, created_at
         FROM feed_posts
         ORDER BY created_at DESC
         LIMIT $1`,
        [grense],
    )
    const posts = postRes.rows
    const postIds = posts.map((p) => p.id)

    if (postIds.length === 0) {
        return []
    }

    const [reaksjonRes, kommentarRes] = await Promise.all([
        client.query<ReaksjonRad>(
            `SELECT post_id::text AS nøkkel, emoji, count(*) AS antall, bool_or(user_id = $2) AS mine
             FROM feed_reactions
             WHERE post_id = ANY($1::uuid[])
             GROUP BY post_id, emoji`,
            [postIds, brukerId],
        ),
        client.query<KommentarRad>(
            `SELECT c.id, c.post_id, c.user_id, c.body, c.created_at,
                    COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name, u.picture
             FROM feed_comments c
             JOIN users u ON u.id = c.user_id
             WHERE c.post_id = ANY($1::uuid[])
             ORDER BY c.created_at ASC`,
            [postIds],
        ),
    ])

    const kommentarIds = kommentarRes.rows.map((k) => k.id)
    const kommentarReaksjoner = kommentarIds.length
        ? (
              await client.query<ReaksjonRad>(
                  `SELECT comment_id::text AS nøkkel, emoji, count(*) AS antall, bool_or(user_id = $2) AS mine
                   FROM feed_comment_reactions
                   WHERE comment_id = ANY($1::uuid[])
                   GROUP BY comment_id, emoji`,
                  [kommentarIds, brukerId],
              )
          ).rows
        : []

    // Bygg reaksjons-oppslag per nøkkel (post-id eller kommentar-id).
    const grupperReaksjoner = (rader: ReaksjonRad[]) => {
        const map = new Map<string, FeedReaksjon[]>()
        for (const r of rader) {
            const liste = map.get(r.nøkkel) ?? []
            liste.push({ emoji: r.emoji, antall: parseInt(r.antall, 10), mine: r.mine })
            map.set(r.nøkkel, liste)
        }
        return map
    }
    const postReaksjonMap = grupperReaksjoner(reaksjonRes.rows)
    const kommentarReaksjonMap = grupperReaksjoner(kommentarReaksjoner)

    const kommentarerPerPost = new Map<string, KommentarRad[]>()
    for (const k of kommentarRes.rows) {
        const liste = kommentarerPerPost.get(k.post_id) ?? []
        liste.push(k)
        kommentarerPerPost.set(k.post_id, liste)
    }

    return posts.map((p) => {
        const kommentarer = (kommentarerPerPost.get(p.id) ?? []).map((k) => ({
            id: k.id,
            navn: visningsnavn(k.name),
            picture: k.picture,
            body: k.body,
            created_at: k.created_at,
            reactions: kommentarReaksjonMap.get(k.id) ?? [],
        }))
        return {
            id: p.id,
            kind: p.kind,
            scenario: p.scenario,
            match_num: p.match_num,
            accent: p.accent,
            tittel: p.tittel,
            body: p.body,
            data: p.data,
            created_at: p.created_at,
            reactions: postReaksjonMap.get(p.id) ?? [],
            kommentarAntall: kommentarer.length,
            kommentarer,
        }
    })
}
