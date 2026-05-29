import { Match } from '../../types/types'
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
    const erEkstraTid = ad?.synced_duration && ad.synced_duration !== 'REGULAR' && ad.synced_home_et !== null
    const erStraffer = ad?.synced_duration === 'PENALTY_SHOOTOUT' && ad.synced_home_pen !== null

    return (
        <BpCard testId={`kamp-${match.match_num}`}>
            <BodyShort spacing>{rundeTilTekst(match.round)}</BodyShort>

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
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-stone-500 w-16">Fulltid</span>
                                    <span className="bp-tabular font-semibold">
                                        {ad.synced_home_ft} – {ad.synced_away_ft}
                                    </span>
                                </div>
                                {erEkstraTid && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-stone-500 w-16">Ekstra tid</span>
                                        <span className="bp-tabular font-semibold">
                                            {ad.synced_home_et} – {ad.synced_away_et}
                                        </span>
                                    </div>
                                )}
                                {erStraffer && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-stone-500 w-16">Straffer</span>
                                        <span className="bp-tabular font-semibold">
                                            {ad.synced_home_pen} – {ad.synced_away_pen}
                                        </span>
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
