import worldcupData from './worldcup2026.json'

export interface Match {
    match_num: number
    round: number
    home_team: string
    away_team: string
    game_start: string
    home_score: number | null
    away_score: number | null
    group?: string
}

interface JsonMatch {
    round: string
    date: string
    time: string
    team1: string
    team2: string
    group?: string
    ground?: string
    num?: number
}

function roundStringToInt(roundStr: string): number {
    if (roundStr.startsWith('Matchday ')) {
        const n = parseInt(roundStr.substring('Matchday '.length), 10)
        if (n <= 7) return 1
        if (n <= 13) return 2
        return 3
    }
    switch (roundStr) {
        case 'Round of 32':
            return 4
        case 'Round of 16':
            return 5
        case 'Quarter-final':
            return 6
        case 'Semi-final':
            return 7
        case 'Match for third place':
            return 8
        case 'Final':
            return 9
        default:
            return 1
    }
}

function parseGameStart(date: string, time: string): string {
    const m = time.match(/^(\d+):(\d+) UTC([+-]\d+(?:\.\d+)?)$/)
    if (!m) throw new Error(`Ugyldig tidsformat: ${time}`)
    const hours = parseInt(m[1], 10)
    const minutes = parseInt(m[2], 10)
    const utcOffset = parseFloat(m[3])
    const localMinutes = hours * 60 + minutes
    const utcMinutes = localMinutes - utcOffset * 60
    const base = new Date(date + 'T00:00:00Z')
    base.setUTCMinutes(base.getUTCMinutes() + utcMinutes)
    return base.toISOString()
}

const _matches: Match[] = (worldcupData.matches as JsonMatch[]).map((m, i) => ({
    match_num: i + 1,
    round: roundStringToInt(m.round),
    home_team: m.team1,
    away_team: m.team2,
    game_start: parseGameStart(m.date, m.time),
    home_score: null,
    away_score: null,
    group: m.group,
}))

const _matchMap = new Map<number, Match>(_matches.map((m) => [m.match_num, m]))

export function getMatches(): Match[] {
    return _matches
}

export function getMatchByNum(num: number): Match | undefined {
    return _matchMap.get(num)
}

export function getMatchMap(): Map<number, Match> {
    return _matchMap
}

// Joker finnes til og med åttendedelsfinalene (Round of 16 = runde 5). Fra
// kvartfinalen og utover er det ikke joker.
export function kanHaJoker(round: number): boolean {
    return round >= 1 && round <= 5
}

export function getMatchNumsInRound(round: number): number[] {
    return _matches.filter((m) => m.round === round).map((m) => m.match_num)
}
