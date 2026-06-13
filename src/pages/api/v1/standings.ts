import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'
import { GroupStanding, StandingRow } from '../../../types/types'

interface StandingDbRow extends StandingRow {
    group: string
}

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { res, user, client } = opts
    if (!user) {
        res.status(401).end()
        return
    }

    const rows = (
        await client.query<StandingDbRow>(
            `SELECT "group", team_tla, position, played, won, draw, lost,
                    goals_for, goals_against, goal_difference, points
             FROM group_standings
             ORDER BY "group" ASC, position ASC`,
        )
    ).rows

    // Grupper radene per gruppe; rekkefølgen innad er allerede position ASC.
    const grupper: GroupStanding[] = []
    const indeks = new Map<string, GroupStanding>()
    for (const rad of rows) {
        let gruppe = indeks.get(rad.group)
        if (!gruppe) {
            gruppe = { group: rad.group, table: [] }
            indeks.set(rad.group, gruppe)
            grupper.push(gruppe)
        }
        gruppe.table.push({
            team_tla: rad.team_tla,
            position: rad.position,
            played: rad.played,
            won: rad.won,
            draw: rad.draw,
            lost: rad.lost,
            goals_for: rad.goals_for,
            goals_against: rad.goals_against,
            goal_difference: rad.goal_difference,
            points: rad.points,
        })
    }

    res.status(200).json(grupper)
}

export default auth(handler)
