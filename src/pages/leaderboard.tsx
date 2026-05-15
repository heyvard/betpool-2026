import type { NextPage } from 'next'

import { Spinner } from '../components/loading/Spinner'
import { UseAllBets } from '../queries/useAllBets'
import NextLink from 'next/link'
import { calculateLeaderboard, LeaderBoard } from '../components/results/calculateAllScores'
import { Table } from '@/components/ui/table'
import classNames from 'classnames'

function plassVisning(plass: number) {
    switch (plass) {
        case 1:
            return '🥇'
        case 2:
            return '🥈'
        case 3:
            return '🥉'
    }
    return plass
}

const Leaderboard: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    if (!data || isLoading) {
        return <Spinner />
    }
    const lista = calculateLeaderboard(data.bets, data.users)
    lista.sort((a, b) => {
        if (b.poeng === a.poeng) {
            return a.userid.localeCompare(b.userid)
        } else {
            return b.poeng - a.poeng
        }
    })

    const finnFaktiskPlass = (index: number, lista: LeaderBoard[]): number => {
        if (index === 0) return 1
        if (lista[index].poeng === lista[index - 1].poeng) {
            return finnFaktiskPlass(index - 1, lista)
        }
        return index + 1
    }
    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.HeaderCell align="center">Plass</Table.HeaderCell>
                    <Table.HeaderCell></Table.HeaderCell>
                    <Table.HeaderCell>Navn</Table.HeaderCell>
                    <Table.HeaderCell align="right">Poeng</Table.HeaderCell>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {lista.map((row, i) => (
                    <Table.Row key={row.userid}>
                        <Table.DataCell align="center">
                            <span className="text-5xl">{plassVisning(finnFaktiskPlass(i, lista))}</span>
                        </Table.DataCell>
                        <Table.DataCell align="left">
                            <NextLink href={'/user/' + row.userid}>
                                <Avatar src={row?.picture} name={row.userName} />
                            </NextLink>
                        </Table.DataCell>
                        <Table.DataCell>
                            <NextLink href={'/user/' + row.userid} className="text-blue-600 hover:underline">
                                {row.userName.split('@')[0]}
                            </NextLink>
                            {!row.paid && '⚠️'}
                        </Table.DataCell>
                        <Table.DataCell align="right" className="pr-4 font-bold">
                            {row.poeng.toFixed(0)}
                        </Table.DataCell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    )
}

interface AvatarProps {
    src?: string | null
    name?: string
    size?: 'small' | 'medium' | 'large'
}

const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'medium' }) => {
    const getInitials = (name: string) => name.charAt(0).toUpperCase()

    const sizeClasses = {
        small: 'w-8 h-8 text-sm',
        medium: 'w-12 h-12 text-lg',
        large: 'w-16 h-16 text-xl',
    }

    return (
        <div className={classNames('flex items-center justify-center bg-stone-200 rounded-full', sizeClasses[size])}>
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={name} className="rounded-full w-full h-full object-cover" />
            ) : (
                <span className="text-white bg-blue-500 rounded-full w-full h-full flex items-center justify-center">
                    {name ? getInitials(name) : ''}
                </span>
            )}
        </div>
    )
}

export default Leaderboard
