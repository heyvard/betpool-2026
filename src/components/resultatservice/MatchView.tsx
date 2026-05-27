import { Match } from '../../types/types'
import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import { hentFlag, hentNorsk } from '../../utils/lag'
import NextLink from 'next/link'
import { UseMutateMatch } from '../../queries/mutateMatch'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import { Save } from 'lucide-react'
import { BpCard } from '../Card'
import nb from 'dayjs/locale/nb'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { BodyShort, Link } from '@/components/ui/typography'

export const MatchView = ({ match }: { match: Match }) => {
    const numberPropTilString = (prop: number | null) => {
        if (prop == null) {
            return ''
        }
        return `${prop}`
    }

    let hjemmescoreProp = numberPropTilString(match.home_score)
    const [hjemmescore, setHjemmescore] = useState<string>(hjemmescoreProp)
    let bortescoreProp = numberPropTilString(match.away_score)
    const [bortescore, setBortescore] = useState<string>(bortescoreProp)
    const [nyligLagret, setNyliglagret] = useState(false)
    const kampstart = dayjs(match.game_start)

    useEffect(() => {
        if (!nyligLagret) return
        const t = setTimeout(() => setNyliglagret(false), 2000)
        return () => clearTimeout(t)
    }, [nyligLagret])

    const lagreCb = () => {
        setNyliglagret(true)
    }

    const stringTilNumber = (prop: string): number | null => {
        if (prop == '') {
            return null
        }
        return Number(prop!)
    }

    const { mutate, isPending } = UseMutateMatch(
        match.match_num,
        stringTilNumber(hjemmescore),
        stringTilNumber(bortescore),
        lagreCb,
    )

    const lagreknappSynlig = (hjemmescore !== hjemmescoreProp || bortescore !== bortescoreProp) && !nyligLagret
    const selectAllFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select()
    }
    return (
        <BpCard testId={`kamp-${match.match_num}`}>
            <BodyShort spacing>{rundeTilTekst(match.round)}</BodyShort>

            <div className="flex items-end mb-1">
                <BodyShort className="flex-1 font-bold text-xl">{fixLand(match.home_team)}</BodyShort>
                <TextField
                    className="w-12 ml-2 shrink-0"
                    type="text"
                    error={lagreknappSynlig}
                    size="small"
                    hideLabel
                    label={match.home_team}
                    inputMode="numeric"
                    value={hjemmescore}
                    onFocus={selectAllFocus}
                    onChange={(e) => {
                        if (!e.currentTarget.value) {
                            setHjemmescore('')
                            return
                        }
                        const number = Number(e.currentTarget.value)
                        if (number >= 0 && number <= 99) {
                            setHjemmescore(String(number))
                        }
                    }}
                />
            </div>
            <div className="flex items-end">
                <BodyShort className="flex-1 font-bold text-xl">{fixLand(match.away_team)}</BodyShort>
                <TextField
                    className="w-12 ml-2 shrink-0"
                    type="text"
                    size="small"
                    inputMode="numeric"
                    error={lagreknappSynlig}
                    value={bortescore}
                    hideLabel
                    label={match.away_team}
                    onFocus={selectAllFocus}
                    onChange={(e) => {
                        if (!e.currentTarget.value) {
                            setBortescore('')
                            return
                        }
                        const number = Number(e.currentTarget.value)
                        if (number >= 0 && number <= 99) {
                            setBortescore(String(number))
                        }
                    }}
                />
            </div>
            {lagreknappSynlig && (
                <Button onClick={() => mutate()} loading={isPending} icon={<Save className="w-4 h-4" />}>
                    Lagre
                </Button>
            )}
            <div className="mt-4">
                <NextLink href={'/match/' + match.match_num}>
                    <Link>Se alles bets på denne kampen</Link>
                </NextLink>
                <BodyShort className="italic text-sm">{kampstart.locale(nb).format('dddd D MMM  HH:mm')}</BodyShort>
            </div>
        </BpCard>
    )
}

export function fixLand(s: string): string {
    return hentFlag(s) + ' ' + hentNorsk(s)
}
