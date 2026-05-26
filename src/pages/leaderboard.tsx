import type { NextPage } from 'next'

import { Spinner } from '../components/loading/Spinner'
import { UseAllBets } from '../queries/useAllBets'
import NextLink from 'next/link'
import { calculateLeaderboard, LeaderBoard } from '../components/results/calculateAllScores'
import { Table } from '@/components/ui/table'
import classNames from 'classnames'
import { UseLeagues } from '../queries/useLeagues'
import { UseLeague } from '../queries/useLeague'
import { UseUser } from '../queries/useUser'
import { useValgtLiga } from '../utils/useValgtLiga'
import { LigaVelger } from '../components/LigaVelger'
import { PremieKort } from '../components/PremieKort'
import { LeagueDetail } from '../types/league'
import { Banknote, Check, Clock } from 'lucide-react'
import { KopierNummerKnapp } from '../components/KopierNummerKnapp'
import { Medalje } from '../components/ui/medalje'

function plassVisning(plass: number): React.ReactNode {
    if (plass === 1 || plass === 2 || plass === 3) return <Medalje plass={plass} size={28} />
    return <span className="bp-tabular text-sm font-semibold text-stone-600">{plass}</span>
}

// users.name er normalt Firebase displayName. Hvis det fortsatt er en
// e-post (eldre brukere / providere uten navn), vis bare delen før @.
function visningsnavn(navn: string): string {
    return navn.includes('@') ? navn.split('@')[0] : navn
}

const Leaderboard: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { data: ligaer } = UseLeagues()
    const { data: megselv } = UseUser()
    const [valgtLiga, setValgtLiga] = useValgtLiga()

    const mineLigaer = (ligaer ?? []).filter((l) => l.my_status === 'medlem')
    // Et lagret valg kan peke på en liga brukeren ikke lenger er med i — fall
    // tilbake til hovedligaen til velgeren får et gyldig valg.
    const effektivLiga = valgtLiga && mineLigaer.some((l) => l.id === valgtLiga) ? valgtLiga : null
    const { data: ligaDetalj } = UseLeague(effektivLiga)

    if (!data || isLoading || !ligaer) {
        return <Spinner />
    }
    if (effektivLiga && !ligaDetalj) {
        return <Spinner />
    }

    const full = calculateLeaderboard(data.bets, data.users)

    // I en privat liga bygger vi tabellen fra medlemslista, slik at også
    // medlemmer uten tipp vises (på 0 poeng). Poengene er de samme som i
    // hovedligaen — `paid` er derimot ligaens egen betalt-status.
    let lista: LeaderBoard[]
    if (effektivLiga && ligaDetalj) {
        lista = ligaDetalj.members
            .filter((m) => m.status === 'medlem')
            .map((m) => {
                const rad = full.find((r) => r.userid === m.user_id)
                return {
                    userid: m.user_id,
                    poeng: rad?.poeng ?? 0,
                    userName: m.name,
                    paid: m.paid,
                    picture: m.picture,
                }
            })
    } else {
        lista = [...full]
    }

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
        <div className="space-y-4">
            {mineLigaer.length > 0 && <LigaVelger ligaer={ligaer} valgt={effektivLiga} onVelg={setValgtLiga} />}
            {ligaDetalj && <LigaBanner liga={ligaDetalj} megId={megselv?.id} />}
            {ligaDetalj && (
                <PremieKort
                    liga={ligaDetalj}
                    antallMedlemmer={ligaDetalj.members.filter((m) => m.status === 'medlem').length}
                />
            )}
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
                            <Table.DataCell align="center">{plassVisning(finnFaktiskPlass(i, lista))}</Table.DataCell>
                            <Table.DataCell align="left">
                                <NextLink href={'/user/' + row.userid}>
                                    <Avatar src={row?.picture} name={row.userName} />
                                </NextLink>
                            </Table.DataCell>
                            <Table.DataCell>
                                <NextLink href={'/user/' + row.userid} className="text-blue-600 hover:underline">
                                    {visningsnavn(row.userName)}
                                </NextLink>
                                {!row.paid && (
                                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
                                        Ikke betalt
                                    </span>
                                )}
                            </Table.DataCell>
                            <Table.DataCell align="right" className="pr-4 font-bold">
                                {row.poeng.toFixed(0)}
                            </Table.DataCell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
        </div>
    )
}

/** Banner over tabellen når en privat liga er valgt — innsats, betalingsinfo og
 *  egen betalt-status. */
function LigaBanner({ liga, megId }: { liga: LeagueDetail; megId?: string }) {
    const { data: megselv } = UseUser()
    const megSelv = liga.members.find((m) => m.user_id === megId)
    const harBetalt = megSelv?.paid ?? false

    return (
        <div className="bp-card">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-lg font-bold text-stone-900">{liga.name}</h1>
                <span className={classNames('shrink-0', harBetalt ? 'bp-chip-green' : 'bp-chip-gold')}>
                    {harBetalt ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    {harBetalt ? 'Du har betalt' : 'Innbetaling mangler'}
                </span>
            </div>
            <p className="mt-0.5 text-xs text-stone-500">Ligavert: {liga.owner_name}</p>

            {liga.innsats != null && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-stone-800">
                    <Banknote className="h-4 w-4 text-stone-400" />
                    Innsats: {liga.innsats} kr
                </p>
            )}
            {liga.betalingsinfo && (
                <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{liga.betalingsinfo}</p>
            )}
            {!harBetalt && liga.innsats != null && megselv && (
                <div className="mt-3">
                    <KopierNummerKnapp nummer="91865052" />
                </div>
            )}
        </div>
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
