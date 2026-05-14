import dayjs from 'dayjs'
import NextLink from 'next/link'
import { MatchBetMedScore } from '../../queries/useAllBets'
import { fixLand } from './BetView'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import React from 'react'
import { BpCard } from '../Card'
import nb from 'dayjs/locale/nb'
import { BodyShort, Link } from '@/components/ui/typography'

export const PastBetView = ({ bet, matchside, navn }: { bet: MatchBetMedScore; matchside: boolean; navn: string }) => {
    const kampstart = dayjs(bet.game_start)
    const bg = () => {
        if (bet.riktigResultat) {
            return 'bg-green-100'
        }
        if (bet.riktigUtfall) {
            return 'bg-green-50'
        }
        return 'bg-red-50'
    }
    return (
        <BpCard bg={bg()}>
            {matchside && <BodyShort spacing>{navn}</BodyShort>}
            {!matchside && <BodyShort spacing>{rundeTilTekst(bet.round)}</BodyShort>}
            <div className="flex items-end mb-1">
                <BodyShort className="w-36 font-bold text-xl">{fixLand(bet.home_team)}</BodyShort>
                <BodyShort className="w-12">{bet.home_score}</BodyShort>
            </div>
            <div className="flex items-end mb-1">
                <BodyShort className="w-36 font-bold text-xl">{fixLand(bet.away_team)}</BodyShort>
                <BodyShort className="w-12">{bet.away_score}</BodyShort>
            </div>
            <BodyShort className="my-4">{bet.poeng} poeng</BodyShort>
            {!matchside && (
                <NextLink href={'/match/' + bet.match_num}>
                    <Link>Se alles bets på denne kampen</Link>
                </NextLink>
            )}
            <BodyShort className="italic text-sm mt-4">{kampstart.locale(nb).format('dddd D MMM  HH:mm')}</BodyShort>
        </BpCard>
    )
}
