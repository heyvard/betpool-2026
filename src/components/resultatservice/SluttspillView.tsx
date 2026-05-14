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

export const SluttspillView = ({ match }: { match: Match }) => {
    const kampstart = dayjs(match.game_start)

    const [lagrer, setLagrer] = useState(false)
    const authedFetch = useAuthedFetch()
    const queryClient = useQueryClient()

    function endreHjemmelag(lag: 'home_team' | 'away_team') {
        function value() {
            if (alleLagSortert.map((l) => l.engelsk).includes(match[lag])) {
                return match[lag]
            } else {
                return 'To be announced'
            }
        }

        return (
            <SelectField
                disabled={lagrer}
                id={String(match.match_num) + lag}
                label={lag === 'home_team' ? 'Hjemmelag' : 'Bortelag'}
                value={value()}
                onChange={async (e) => {
                    let team = e.target.value
                    try {
                        setLagrer(true)
                        const val = {} as Record<string, string>
                        val[lag] = team
                        const response = await authedFetch(`/api/v1/matches/${match.match_num}`, {
                            method: 'PUT',
                            body: JSON.stringify(val),
                        })
                        if (!response.ok) {
                            window.alert('oops, feil ved lagring')
                        }
                        queryClient.invalidateQueries({ queryKey: ['matches'] }).then()
                    } finally {
                        setLagrer(false)
                    }
                }}
            >
                {alleLagSortert.map((l) => (
                    <option key={l.engelsk} value={l.engelsk}>
                        {l.flagg + ' ' + l.norsk}
                    </option>
                ))}
                <option value="To be announced">TBA</option>
            </SelectField>
        )
    }

    return (
        <BpCard>
            <BodyShort spacing>{rundeTilTekst(match.round)}</BodyShort>
            <BodyShort className="italic text-sm" spacing>
                {kampstart.locale(nb).format('dddd D MMM  HH:mm')}
            </BodyShort>
            {endreHjemmelag('home_team')}
            {endreHjemmelag('away_team')}
        </BpCard>
    )
}
