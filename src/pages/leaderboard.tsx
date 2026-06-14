import type { NextPage } from 'next'
import { useMemo, useState } from 'react'

import { Spinner } from '../components/loading/Spinner'
import { UseAllBets } from '../queries/useAllBets'
import NextLink from 'next/link'
import { calculateLeaderboard, LeaderBoard } from '../components/results/calculateAllScores'
import { calculateAllBetsExtended, filtrerAllBets } from '../components/results/calculateAllBetsExtended'
import { Table } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import classNames from 'classnames'
import { UseLeagues } from '../queries/useLeagues'
import { UseLeague } from '../queries/useLeague'
import { useValgtLiga } from '../utils/useValgtLiga'
import { LigaVelger } from '../components/LigaVelger'
import { Medalje } from '../components/ui/medalje'
import { useLanguage } from '../i18n/LanguageContext'

function plassVisning(plass: number): React.ReactNode {
    if (plass === 1 || plass === 2 || plass === 3) return <Medalje plass={plass} size={28} />
    return <span className="bp-tabular text-sm font-semibold text-stone-600">{plass}</span>
}

function visningsnavn(navn: string): string {
    return navn.includes('@') ? navn.split('@')[0] : navn
}

// Stabil «tilfeldig» sorteringsnøkkel for en bruker, bestemt av en seed som
// settes én gang per økt. Brukes når alle har 0 poeng, slik at rekkefølgen
// ikke hopper rundt ved hver re-render.
function ordningsverdi(seed: number, userid: string): number {
    let h = seed | 0
    for (let i = 0; i < userid.length; i++) {
        h = (Math.imul(31, h) + userid.charCodeAt(i)) | 0
    }
    return h
}

const Leaderboard: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { data: ligaer } = UseLeagues()
    const [valgtLiga, setValgtLiga] = useValgtLiga()
    const { t } = useLanguage()
    // Seed for tilfeldig rangering når alle har 0 poeng – stabil per økt.
    const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff))
    // Bryter for å inkludere foreløpige poeng fra kamper som pågår. Står på som standard.
    const [visPågående, setVisPågående] = useState(true)

    const mineLigaer = (ligaer ?? []).filter((l) => l.my_status === 'medlem')
    const effektivLiga = valgtLiga && mineLigaer.some((l) => l.id === valgtLiga) ? valgtLiga : null
    const { data: ligaDetalj } = UseLeague(effektivLiga)

    // Poeng beregnes populasjonsspesifikt: hovedligaen kun fra hovedligaens
    // medlemmer, en privat liga fra hovedligaens medlemmer + ligaens egne. Slik
    // påvirker ikke de som bare er i private ligaer hovedligaens resultater.
    const rader = useMemo<LeaderBoard[]>(() => {
        if (!data) return []
        const raw = data.raw
        const hovedligaIds = new Set(raw.users.filter((u) => u.i_hovedliga !== false).map((u) => u.id))
        const hovedligaExt = calculateAllBetsExtended(filtrerAllBets(raw, hovedligaIds))
        const hovedligaTavle = calculateLeaderboard(hovedligaExt.bets, hovedligaExt.users)

        if (effektivLiga && ligaDetalj) {
            const populasjon = new Set(hovedligaIds)
            ligaDetalj.members.forEach((m) => populasjon.add(m.user_id))
            const ext = calculateAllBetsExtended(filtrerAllBets(raw, populasjon))
            const tavle = calculateLeaderboard(ext.bets, ext.users)
            const poengMap = new Map(tavle.map((r) => [r.userid, r.poeng]))
            const liveMap = new Map(tavle.map((r) => [r.userid, r.livePoeng ?? 0]))
            return ligaDetalj.members
                .filter((m) => m.status === 'medlem')
                .map((m) => ({
                    userid: m.user_id,
                    poeng: poengMap.get(m.user_id) ?? 0,
                    livePoeng: liveMap.get(m.user_id) ?? 0,
                    userName: m.name,
                    paid: m.paid,
                    picture: m.picture,
                }))
        }
        return hovedligaTavle
    }, [data, effektivLiga, ligaDetalj])

    if (!data || isLoading || !ligaer) {
        return <Spinner />
    }
    if (effektivLiga && !ligaDetalj) {
        return <Spinner />
    }

    const lista: LeaderBoard[] = [...rader]

    // Effektiv poengsum gitt bryteren: med pågående kamper teller hele summen,
    // uten dem trekkes de foreløpige poengene fra.
    const effektivPoeng = (r: LeaderBoard): number => (visPågående ? r.poeng : r.poeng - (r.livePoeng ?? 0))

    // Bryteren vises kun når minst én bruker har foreløpige poeng fra en pågående kamp.
    const harPågående = rader.some((r) => (r.livePoeng ?? 0) !== 0)

    // Når ingen kamper er ferdigspilt har alle 0 poeng. Da gir det ikke mening
    // at alle deler 1. plass (og får gullmedalje) – ranger i stedet tilfeldig
    // med unike plasser, slik at bare én får medalje nr. 1.
    const alleNull = lista.length > 0 && lista.every((r) => effektivPoeng(r) === 0)

    if (alleNull) {
        lista.sort((a, b) => ordningsverdi(seed, a.userid) - ordningsverdi(seed, b.userid))
    } else {
        lista.sort((a, b) => {
            if (effektivPoeng(b) === effektivPoeng(a)) {
                return a.userid.localeCompare(b.userid)
            } else {
                return effektivPoeng(b) - effektivPoeng(a)
            }
        })
    }

    const finnFaktiskPlass = (index: number, lista: LeaderBoard[]): number => {
        if (alleNull) return index + 1
        if (index === 0) return 1
        if (effektivPoeng(lista[index]) === effektivPoeng(lista[index - 1])) {
            return finnFaktiskPlass(index - 1, lista)
        }
        return index + 1
    }

    return (
        <div className="space-y-4">
            {mineLigaer.length > 0 && <LigaVelger ligaer={ligaer} valgt={effektivLiga} onVelg={setValgtLiga} />}
            {harPågående && (
                <div className="flex justify-end">
                    <Switch checked={visPågående} onCheckedChange={setVisPågående} size="small">
                        {t.ledertavle.visPågående}
                    </Switch>
                </div>
            )}
            <Table>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell align="center">{t.ledertavle.plass}</Table.HeaderCell>
                        <Table.HeaderCell></Table.HeaderCell>
                        <Table.HeaderCell>{t.ledertavle.navn}</Table.HeaderCell>
                        <Table.HeaderCell align="right">{t.ledertavle.poeng}</Table.HeaderCell>
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
                                        {t.ledertavle.ikkeBetalt}
                                    </span>
                                )}
                            </Table.DataCell>
                            <Table.DataCell align="right" className="pr-4 font-bold">
                                <span className="inline-flex flex-col items-end gap-0.5">
                                    {visPågående && (row.livePoeng ?? 0) > 0 && (
                                        <span className="bp-chip-live">+{(row.livePoeng ?? 0).toFixed(0)}</span>
                                    )}
                                    <span className="bp-tabular">{effektivPoeng(row).toFixed(0)}</span>
                                </span>
                            </Table.DataCell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
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
