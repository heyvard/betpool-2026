import { Match } from '../../types/types'
import dayjs from 'dayjs'
import React, { useState } from 'react'
import { alleLagSortert } from '../../utils/lag'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import { useAuthedFetch } from '../../auth/authedFetch'
import { useQueryClient } from '@tanstack/react-query'
import { BpCard } from '../Card'
import nb from 'dayjs/locale/nb'
import { SelectField } from '@/components/ui/select-field'
import { BodyShort } from '@/components/ui/typography'

const LAG_OPTIONS = (
    <>
        {alleLagSortert.map((l) => (
            <option key={l.tla} value={l.tla}>
                {l.flagg + ' ' + l.norsk}
            </option>
        ))}
        <option value="To be announced">TBA</option>
    </>
)

const ALLE_LAG_TLA = new Set(alleLagSortert.map((l) => l.tla))

function TeamSelect({
    match,
    side,
    lagrer,
    onChange,
}: {
    match: Match
    side: 'home_team' | 'away_team'
    lagrer: boolean
    onChange: (team: string) => void
}) {
    const current = ALLE_LAG_TLA.has(match[side]) ? match[side] : 'To be announced'
    return (
        <SelectField
            disabled={lagrer}
            id={String(match.match_num) + side}
            label={side === 'home_team' ? 'Hjemmelag' : 'Bortelag'}
            value={current}
            onChange={(e) => onChange(e.target.value)}
        >
            {LAG_OPTIONS}
        </SelectField>
    )
}

export const SluttspillView = ({ match }: { match: Match }) => {
    const kampstart = dayjs(match.game_start)
    const [lagrer, setLagrer] = useState(false)
    const authedFetch = useAuthedFetch()
    const queryClient = useQueryClient()

    const lagre = async (side: 'home_team' | 'away_team', team: string) => {
        try {
            setLagrer(true)
            const body = { [side]: team }
            const response = await authedFetch(`/api/v1/matches/${match.match_num}`, {
                method: 'PUT',
                body: JSON.stringify(body),
            })
            if (!response.ok) {
                window.alert('oops, feil ved lagring')
            }
            queryClient.invalidateQueries({ queryKey: ['matches'] }).then()
        } finally {
            setLagrer(false)
        }
    }

    return (
        <BpCard>
            <BodyShort spacing>{rundeTilTekst(match.round)}</BodyShort>
            <BodyShort className="italic text-sm" spacing>
                {kampstart.locale(nb).format('dddd D MMM  HH:mm')}
            </BodyShort>
            <TeamSelect match={match} side="home_team" lagrer={lagrer} onChange={(team) => lagre('home_team', team)} />
            <TeamSelect match={match} side="away_team" lagrer={lagrer} onChange={(team) => lagre('away_team', team)} />
        </BpCard>
    )
}
