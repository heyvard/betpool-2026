import type { NextPage } from 'next'

import { Spinner } from '../components/loading/Spinner'
import { UseAllBets } from '../queries/useAllBets'
import NextLink from 'next/link'
import { Table } from '@/components/ui/table'
import { Link } from '@/components/ui/typography'

const Leaderboard: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    if (!data || isLoading) {
        return <Spinner />
    }

    const sortertePerToppscorer = [...data.users].sort(
        (a, b) => a.topscorer_player_name?.localeCompare(b.topscorer_player_name || '') || 0,
    )

    return (
        <Table size="small">
            <Table.Header>
                <Table.Row>
                    <Table.HeaderCell>Navn</Table.HeaderCell>
                    <Table.HeaderCell>Toppscorer</Table.HeaderCell>
                    <Table.HeaderCell align="right">Poeng</Table.HeaderCell>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {sortertePerToppscorer.map((user, i) => (
                    <Table.Row key={i}>
                        <Table.DataCell>
                            <NextLink href={'/user/' + user?.id}>
                                <Link>{user?.name}</Link>
                            </NextLink>
                        </Table.DataCell>
                        <Table.DataCell>
                            {user.topscorer_endret && user.topscorer_forrige_player_name ? (
                                <span className="flex flex-col gap-0.5">
                                    <span className="text-stone-400 line-through text-xs">
                                        {user.topscorer_forrige_player_name}
                                    </span>
                                    <span>{user.topscorer_player_name}</span>
                                </span>
                            ) : (
                                user.topscorer_player_name
                            )}
                        </Table.DataCell>
                        <Table.DataCell align="right">{user.topscorerPoints}</Table.DataCell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    )
}

export default Leaderboard
