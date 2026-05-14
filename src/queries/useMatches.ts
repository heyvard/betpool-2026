import dayjs from 'dayjs'
import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { Match } from '../types/types'

export function UseMatches() {
    const authedFetch = useAuthedFetch()

    return useQuery({
        queryKey: ['matches'],

        queryFn: async () => {
            const response = await authedFetch('/api/v1/matches', { method: 'GET' })
            let matchene: Match[] = await response.json()
            matchene.sort((a, b) => dayjs(a.game_start).unix() - dayjs(b.game_start).unix())
            return matchene
        },
    })
}
