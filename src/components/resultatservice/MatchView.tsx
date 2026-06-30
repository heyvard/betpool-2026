import { Match, MatchStatus } from '../../types/types'
import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import { hentFlag, hentNorsk } from '../../utils/lag'
import NextLink from 'next/link'
import { UseMutateMatch } from '../../queries/mutateMatch'
import { UseMutateUseManual } from '../../queries/mutateUseManual'
import { rundeTilTekst } from '../../utils/rundeTilTekst'
import { Save } from 'lucide-react'
import { BpCard } from '../Card'
import nb from 'dayjs/locale/nb'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { Switch } from '@/components/ui/switch'
import { BodyShort, Link } from '@/components/ui/typography'

export const MatchView = ({ match }: { match: Match }) => {
    const numberPropTilString = (prop: number | null | undefined) => {
        if (prop == null) return ''
        return `${prop}`
    }

    const ad = match.adminData

    const manualHomeProp = numberPropTilString(ad?.manual_home_score)
    const manualAwayProp = numberPropTilString(ad?.manual_away_score)

    const [hjemmescore, setHjemmescore] = useState<string>(manualHomeProp)
    const [bortescore, setBortescore] = useState<string>(manualAwayProp)
    const [nyligLagret, setNyliglagret] = useState(false)
    const kampstart = dayjs(match.game_start)

    useEffect(() => {
        if (!nyligLagret) return
        const t = setTimeout(() => setNyliglagret(false), 2000)
        return () => clearTimeout(t)
    }, [nyligLagret])

    const lagreCb = () => setNyliglagret(true)

    const stringTilNumber = (prop: string): number | null => {
        if (prop === '') return null
        return Number(prop)
    }

    const { mutate, isPending } = UseMutateMatch(
        match.match_num,
        stringTilNumber(hjemmescore),
        stringTilNumber(bortescore),
        lagreCb,
    )

    const { mutate: mutateUseManual, isPending: isPendingSwitch } = UseMutateUseManual(match.match_num)

    const lagreknappSynlig = (hjemmescore !== manualHomeProp || bortescore !== manualAwayProp) && !nyligLagret

    const selectAllFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

    const harSynketScore = ad?.synced_home_ft !== null && ad?.synced_home_ft !== undefined
    // Sluttspillkamp som gikk forbi 90 min: football-data sender ordinær tid separat.
    // Da er ordinær tid (rt) tippe-resultatet — det aktive resultatet resten av appen
    // bruker — mens fulltid (ft) er totalen inkl. ekstraomganger/straffer.
    const harRegulærTid = ad?.synced_home_rt !== null && ad?.synced_home_rt !== undefined
    const duration = (ad?.synced_duration ?? '').toUpperCase()
    const erEkstraTid = (duration.includes('EXTRA') || duration.includes('PENALT')) && ad?.synced_home_et != null
    const erStraffer = duration.includes('PENALT') && ad?.synced_home_pen != null
    // Stillingen etter ekstraomganger = ordinær tid + det som ble scoret i ekstraomgangene.
    const ekstraHome = harRegulærTid && ad?.synced_home_et != null ? ad.synced_home_rt! + ad.synced_home_et : null
    const ekstraAway = harRegulærTid && ad?.synced_away_et != null ? ad.synced_away_rt! + ad.synced_away_et : null
    const vinnerTla =
        ad?.synced_winner === 'HOME_TEAM' ? match.home_team : ad?.synced_winner === 'AWAY_TEAM' ? match.away_team : null

    const status = statusVisning(match.status)

    return (
        <BpCard testId={`kamp-${match.match_num}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
                <BodyShort>{rundeTilTekst(match.round)}</BodyShort>
                <span className={status.chip} data-testid={`status-${match.match_num}`}>
                    {status.tekst}
                </span>
            </div>

            <div className="flex items-center gap-2 mb-3">
                <BodyShort className="font-bold text-xl flex-1">{fixLand(match.home_team)}</BodyShort>
                <BodyShort className="font-bold text-xl flex-1">{fixLand(match.away_team)}</BodyShort>
            </div>

            {ad ? (
                <>
                    {/* Automatisk / synket seksjon */}
                    <div
                        className={`rounded-lg p-3 mb-3 ${
                            !ad.use_manual ? 'ring-1 ring-gold-300 bg-gold-50' : 'bg-stone-50 ring-1 ring-stone-200'
                        }`}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bp-overline">Automatisk</span>
                            {!ad.use_manual && <span className="bp-chip-gold text-xs">Aktiv</span>}
                        </div>
                        {harSynketScore ? (
                            <div className="space-y-1">
                                {harRegulærTid ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-stone-500 w-20">Ordinær tid</span>
                                        <span className="bp-tabular font-semibold">
                                            {ad.synced_home_rt} – {ad.synced_away_rt}
                                        </span>
                                        <span className="bp-chip-gold text-[10px]">Tippes</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-stone-500 w-20">Fulltid</span>
                                        <span className="bp-tabular font-semibold">
                                            {ad.synced_home_ft} – {ad.synced_away_ft}
                                        </span>
                                    </div>
                                )}
                                {erEkstraTid && ekstraHome !== null && ekstraAway !== null && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-stone-500 w-20">Etter e.o.</span>
                                        <span className="bp-tabular font-semibold">
                                            {ekstraHome} – {ekstraAway}
                                        </span>
                                    </div>
                                )}
                                {erStraffer && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-stone-500 w-20">Straffer</span>
                                        <span className="bp-tabular font-semibold">
                                            {ad.synced_home_pen} – {ad.synced_away_pen}
                                        </span>
                                    </div>
                                )}
                                {vinnerTla && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-stone-500 w-20">Videre</span>
                                        <span className="font-semibold">{fixLand(vinnerTla)}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <BodyShort className="text-sm text-stone-400 italic">Ikke synkronisert ennå</BodyShort>
                        )}
                        {ad.score_synced_at && (
                            <BodyShort className="text-xs text-stone-400 mt-1">
                                Synket {dayjs(ad.score_synced_at).locale(nb).format('D MMM HH:mm:ss')}
                            </BodyShort>
                        )}
                    </div>

                    {/* Manuell seksjon */}
                    <div
                        className={`rounded-lg p-3 mb-3 ${
                            ad.use_manual ? 'ring-1 ring-gold-300 bg-gold-50' : 'bg-stone-50 ring-1 ring-stone-200'
                        }`}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bp-overline">Manuelt</span>
                            {ad.use_manual && <span className="bp-chip-gold text-xs">Aktiv</span>}
                        </div>
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
                                    if (number >= 0 && number <= 99) setHjemmescore(String(number))
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
                                    if (number >= 0 && number <= 99) setBortescore(String(number))
                                }}
                            />
                        </div>
                        {lagreknappSynlig && (
                            <Button
                                onClick={() => mutate()}
                                loading={isPending}
                                icon={<Save className="w-4 h-4" />}
                                className="mt-2"
                            >
                                Lagre
                            </Button>
                        )}
                    </div>

                    {/* Kilde-switch */}
                    <div className="flex items-center gap-3 pt-1">
                        <Switch
                            checked={ad.use_manual}
                            onCheckedChange={(checked) => mutateUseManual(checked)}
                            loading={isPendingSwitch}
                        >
                            Bruk manuell score
                        </Switch>
                    </div>
                </>
            ) : (
                /* Fallback for ikke-scoreadmin eller kamp uten match_scores-rad */
                <>
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
                                if (number >= 0 && number <= 99) setHjemmescore(String(number))
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
                                if (number >= 0 && number <= 99) setBortescore(String(number))
                            }}
                        />
                    </div>
                    {lagreknappSynlig && (
                        <Button onClick={() => mutate()} loading={isPending} icon={<Save className="w-4 h-4" />}>
                            Lagre
                        </Button>
                    )}
                </>
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

// Kampstatusen vi har lagret fra football-data-synken, vist som chip slik at
// scoreadmin ser om kampen er ferdig, pågår eller fortsatt venter — nyttig når
// man vurderer om en synket score kan stoles på.
function statusVisning(status: MatchStatus): { tekst: string; chip: string } {
    switch (status) {
        case 'IN_PLAY':
            return { tekst: 'Pågår', chip: 'bp-chip-live' }
        case 'PAUSED':
            return { tekst: 'Pause', chip: 'bp-chip-live' }
        case 'FINISHED':
            return { tekst: 'Ferdig', chip: 'bp-chip-green' }
        case 'AWARDED':
            return { tekst: 'Avgjort', chip: 'bp-chip-green' }
        case 'SCHEDULED':
            return { tekst: 'Planlagt', chip: 'bp-chip-blue' }
        case 'TIMED':
            return { tekst: 'Ikke startet', chip: 'bp-chip-blue' }
        case 'SUSPENDED':
            return { tekst: 'Avbrutt', chip: 'bp-chip-gold' }
        case 'POSTPONED':
            return { tekst: 'Utsatt', chip: 'bp-chip-gold' }
        case 'CANCELLED':
            return { tekst: 'Avlyst', chip: 'bp-chip-gold' }
    }
}
