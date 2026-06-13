import type { NextPage } from 'next'

import { Spinner } from '../components/loading/Spinner'
import { Table } from '@/components/ui/table'
import { UseStandings } from '../queries/useStandings'
import { gruppeTilVisning } from '../utils/gruppeTilVisning'
import { hentFlag, hentNavn } from '../utils/lag'
import { useLanguage } from '../i18n/LanguageContext'

const Grupper: NextPage = () => {
    const { data, isLoading } = UseStandings()
    const { t, locale } = useLanguage()

    if (!data || isLoading) {
        return <Spinner />
    }

    if (data.length === 0) {
        return (
            <div className="space-y-4">
                <h1 className="text-lg font-bold text-stone-900">{t.grupper.tittel}</h1>
                <div className="bp-card text-sm text-stone-600">{t.grupper.tom}</div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h1 className="text-lg font-bold text-stone-900">{t.grupper.tittel}</h1>
            {data.map((gruppe) => (
                <div key={gruppe.group} className="bp-card">
                    <h2 className="bp-overline mb-2">{gruppeTilVisning(gruppe.group, locale)}</h2>
                    <Table size="small">
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell align="center">#</Table.HeaderCell>
                                <Table.HeaderCell>{t.grupper.lag}</Table.HeaderCell>
                                <Table.HeaderCell align="center">{t.grupper.spilte}</Table.HeaderCell>
                                <Table.HeaderCell align="center">{t.grupper.seier}</Table.HeaderCell>
                                <Table.HeaderCell align="center">{t.grupper.uavgjort}</Table.HeaderCell>
                                <Table.HeaderCell align="center">{t.grupper.tap}</Table.HeaderCell>
                                <Table.HeaderCell align="center">{t.grupper.malforskjell}</Table.HeaderCell>
                                <Table.HeaderCell align="right">{t.grupper.poeng}</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {gruppe.table.map((rad) => (
                                <Table.Row key={rad.team_tla}>
                                    <Table.DataCell align="center" className="bp-tabular text-stone-500">
                                        {rad.position}
                                    </Table.DataCell>
                                    <Table.DataCell>
                                        <span className="flex items-center gap-2">
                                            <span aria-hidden>{hentFlag(rad.team_tla)}</span>
                                            <span className="font-medium text-stone-800">
                                                {hentNavn(rad.team_tla, locale)}
                                            </span>
                                        </span>
                                    </Table.DataCell>
                                    <Table.DataCell align="center" className="bp-tabular">
                                        {rad.played}
                                    </Table.DataCell>
                                    <Table.DataCell align="center" className="bp-tabular">
                                        {rad.won}
                                    </Table.DataCell>
                                    <Table.DataCell align="center" className="bp-tabular">
                                        {rad.draw}
                                    </Table.DataCell>
                                    <Table.DataCell align="center" className="bp-tabular">
                                        {rad.lost}
                                    </Table.DataCell>
                                    <Table.DataCell align="center" className="bp-tabular">
                                        {rad.goal_difference > 0 ? `+${rad.goal_difference}` : rad.goal_difference}
                                    </Table.DataCell>
                                    <Table.DataCell align="right" className="bp-tabular font-bold text-stone-900">
                                        {rad.points}
                                    </Table.DataCell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </div>
            ))}
        </div>
    )
}

export default Grupper
