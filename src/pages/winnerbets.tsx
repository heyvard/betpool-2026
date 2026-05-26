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
    const sortertePerVinner = [...data.users].sort((a, b) => a.winner?.localeCompare(b.winner || '') || 0)

    return (
        <Table size="small">
            <Table.Header>
                <Table.Row>
                    <Table.HeaderCell>Navn</Table.HeaderCell>
                    <Table.HeaderCell>Vinner</Table.HeaderCell>
                    <Table.HeaderCell align="right">Poeng</Table.HeaderCell>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {sortertePerVinner.map((user, i) => (
                    <Table.Row key={i}>
                        <Table.DataCell>
                            <NextLink href={'/user/' + user?.id}>
                                <Link>{user?.name}</Link>
                            </NextLink>
                        </Table.DataCell>
                        <Table.DataCell>{user.winner}</Table.DataCell>
                        <Table.DataCell align="right">{user.winnerPoints}</Table.DataCell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    )
}

export default Leaderboard
