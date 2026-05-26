import dayjs from 'dayjs'
import { Bet } from '../types/types'
import { erNorgeKamp } from '../data/matches'
import { fixLand, JokerContext } from '../components/bet/BetView'
import { nå } from './testClock'

/**
 * Bygger en map fra runde → bet som har jokeren i den runden. Norge-kamper
 * kan ikke jokres, så en evt. gammel joker der ignoreres.
 */
export function byggJokerPerRunde(bets: Bet[]): Map<number, Bet> {
    const m = new Map<number, Bet>()
    bets.forEach((b) => {
        if (b.joker && !erNorgeKamp(b.home_team, b.away_team)) m.set(b.round, b)
    })
    return m
}

/** JokerContext for en gitt kamp, gitt hvilken kamp som har jokeren i hver runde. */
export function jokerContextFor(bet: Bet, jokerPerRunde: Map<number, Bet>): JokerContext {
    const k = jokerPerRunde.get(bet.round)
    if (!k) return { aktiv: false, bruktPå: null, låst: false }
    if (k.match_num === bet.match_num) return { aktiv: true, bruktPå: null, låst: false }
    return {
        aktiv: false,
        bruktPå: `${fixLand(k.home_team)} – ${fixLand(k.away_team)}`,
        låst: dayjs(k.game_start).isBefore(nå()),
    }
}
