import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

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
    kind: 'kamp' | 'morgenrapport' | 'bytte' | 'podium'
    scenario: string
    accent: 'win' | 'live' | 'gold' | 'stone' | 'royal'
    tittel: string
    body: string
    // Råverdiene som ble flettet inn — fronten rendrer score-blokk/lister herfra.
    data: Record<string, unknown>
    created_at: string
    match_num: number | null
    reactions: FeedReaksjon[]
    kommentarAntall: number
    kommentarer: FeedKommentar[]
}

export interface FeedRespons {
    posts: FeedPost[]
}

export const FEED_QUERY_KEY = ['feed']

export function UseFeed() {
    const authedFetch = useAuthedFetch()

    return useQuery<FeedRespons>({
        queryKey: FEED_QUERY_KEY,
        queryFn: async () => {
            const response = await authedFetch('/api/v1/feed', { method: 'GET' })
            if (!response.ok) throw new Error('Kunne ikke hente feed')
            return response.json()
        },
    })
}

// Toggler din egen reaksjon i en reaksjons-liste (optimistisk). Returnerer ny liste.
export function toggleReaksjon(reactions: FeedReaksjon[], emoji: string): FeedReaksjon[] {
    const eksisterende = reactions.find((r) => r.emoji === emoji)
    if (eksisterende) {
        if (eksisterende.mine) {
            // Fjern min reaksjon; dropp pillen om den blir tom.
            const ny = reactions
                .map((r) => (r.emoji === emoji ? { ...r, antall: r.antall - 1, mine: false } : r))
                .filter((r) => r.antall > 0)
            return ny
        }
        return reactions.map((r) => (r.emoji === emoji ? { ...r, antall: r.antall + 1, mine: true } : r))
    }
    return [...reactions, { emoji, antall: 1, mine: true }]
}
