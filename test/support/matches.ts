import fixtures from '../../src/data/footballDataFixtures.json'
import { FootballDataMatch, transformerKamp } from '../../src/data/footballDataMatch'
import { Match } from '../../src/types/types'

// Synkron kampliste for tester, utledet fra det samme datasettet som migreringen
// seeder `matches`-tabellen fra. Holder testene uavhengige av en DB-spørring når
// de bare skal velge kamper for et scenario.
export function testKamper(): Match[] {
    return (fixtures.matches as FootballDataMatch[])
        .map(transformerKamp)
        .sort((a, b) => new Date(a.game_start).getTime() - new Date(b.game_start).getTime())
}
