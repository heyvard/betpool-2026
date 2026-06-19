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

        // Poll så scoren oppdateres mens en kamp pågår. Selve kallet trigger en
        // throttlet live-synk fra football-data.org server-side. Vi poller raskt
        // (15s) kun når en kamp faktisk er IN_PLAY/PAUSED; ellers 60s — nok til å
        // fange at en kamp starter, men sparer Neon-compute og API-kall i idle-
        // perioder. refetchIntervalInBackground = false → polling pauses når
        // fanen er skjult, så API-budsjettet brukes kun når noen ser på appen.
        refetchInterval: (query) => {
            const harLive = query.state.data?.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED')
            return harLive ? LIVE_SYNC_INTERVAL_SEKUNDER * 1000 : 60_000
        },
        refetchIntervalInBackground: false,
    })
}
