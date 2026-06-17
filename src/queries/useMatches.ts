import dayjs from 'dayjs'
import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { LIVE_SYNC_INTERVAL_SEKUNDER } from '../utils/liveSync'
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

        // Poll så scoren oppdateres jevnlig mens appen er oppe. Selve kallet
        // trigger en throttlet live-synk fra football-data.org server-side.
        // refetchIntervalInBackground = false → polling pauses når fanen er
        // skjult, så API-budsjettet brukes kun når noen faktisk ser på appen.
        refetchInterval: LIVE_SYNC_INTERVAL_SEKUNDER * 1000,
        refetchIntervalInBackground: false,
    })
}
