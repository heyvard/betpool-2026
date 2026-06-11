import type { NextPage } from 'next'
import { Spinner } from '../components/loading/Spinner'
import React from 'react'
import { UseUser } from '../queries/useUser'
import {
    UseMutateAdminCron,
    UseDryRunSyncMatches,
    UseDryRunSyncScores,
    UseDryRunSendReminders,
    UseDryRunSendVmStart,
    VmStartDryRunBruker,
    DryRunEndring,
    DryRunScoreKamp,
    DryRunBruker,
} from '../queries/mutateAdminCron'
import { Button } from '@/components/ui/button'
import { RefreshCw, Bell, Calendar, Eye, Trophy } from 'lucide-react'

function formaterFeltVerdi(felt: string, verdi: string | number | null): string {
    if (verdi === null) return 'null'
    if (felt === 'game_start') {
        try {
            return new Date(verdi as string).toLocaleString('nb-NO', {
                timeZone: 'Europe/Oslo',
                dateStyle: 'short',
                timeStyle: 'short',
            })
        } catch {
            return String(verdi)
        }
    }
    return String(verdi)
}

function DryRunEndringRad({ endring }: { endring: DryRunEndring }) {
    const kamp =
        endring.home_team && endring.away_team
            ? `${endring.home_team} vs ${endring.away_team}`
            : `kamp ${endring.match_num}`

    return (
        <li className="text-blue-800">
            <span className="font-medium">{kamp}</span>
            {endring.ny ? (
                <span className="ml-1 text-blue-500">[ny kamp]</span>
            ) : (
                <>
                    {': '}
                    {endring.felt.map((f, i) => (
                        <span key={f}>
                            {i > 0 && ', '}
                            <span className="font-mono text-[11px]">{f}</span>{' '}
                            <span className="text-stone-400">{formaterFeltVerdi(f, endring.fra[f] ?? null)}</span>
                            {' → '}
                            <span>{formaterFeltVerdi(f, endring.til[f] ?? null)}</span>
                        </span>
                    ))}
                </>
            )}
        </li>
    )
}

function scoreStreng(ft: { home: number | null; away: number | null }): string {
    if (ft.home === null || ft.away === null) return '–'
    return `${ft.home}–${ft.away}`
}

function DryRunScoreKampRad({ kamp }: { kamp: DryRunScoreKamp }) {
    const lagNavn =
        kamp.home_team && kamp.away_team ? `${kamp.home_team} vs ${kamp.away_team}` : `kamp ${kamp.match_num}`

    const apiScore = scoreStreng(kamp.api.fullTime)
    const dbScore =
        kamp.db !== null && kamp.db.synced_home_ft !== null && kamp.db.synced_away_ft !== null
            ? `${kamp.db.synced_home_ft}–${kamp.db.synced_away_ft}`
            : '(ingen)'

    const ekstraInfo: string[] = []
    if (kamp.api.extraTime?.home !== null && kamp.api.extraTime?.away !== null) {
        ekstraInfo.push(`ET: ${kamp.api.extraTime?.home}–${kamp.api.extraTime?.away}`)
    }
    if (kamp.api.penalties?.home !== null && kamp.api.penalties?.away !== null) {
        ekstraInfo.push(`pen: ${kamp.api.penalties?.home}–${kamp.api.penalties?.away}`)
    }
    if (kamp.api.duration && kamp.api.duration !== 'REGULAR') {
        ekstraInfo.push(kamp.api.duration)
    }

    return (
        <li className={`text-xs ${kamp.relevant ? 'text-blue-800' : 'text-stone-400'}`}>
            <span className="font-medium">{lagNavn}</span>
            <span className="ml-1 font-mono text-[11px] text-stone-500">[{kamp.status}]</span>
            {' — '}
            <span className="font-mono">
                API: <span className={kamp.villeBlittOppdatert ? 'font-bold text-blue-700' : ''}>{apiScore}</span>
            </span>
            {kamp.db !== null && <span className="ml-1 text-stone-400 font-mono">DB: {dbScore}</span>}
            {ekstraInfo.length > 0 && <span className="ml-1 text-stone-400">({ekstraInfo.join(', ')})</span>}
            {kamp.villeBlittOppdatert && <span className="ml-1 text-blue-500 font-medium">↑ oppdateres</span>}
        </li>
    )
}

function SyncScoresKnapp() {
    const { mutate, isPending, data, error, isSuccess } = UseMutateAdminCron('sync-scores')
    const {
        mutate: dryMutate,
        isPending: dryPending,
        data: dryData,
        error: dryError,
        isSuccess: drySuccess,
    } = UseDryRunSyncScores()

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Synk resultater</p>
                    <p className="text-xs text-stone-500">
                        Henter live-scores fra football-data.org for pågående og nylig ferdige kamper.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="small"
                        loading={dryPending}
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => dryMutate()}
                    >
                        Dry run
                    </Button>
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        icon={<RefreshCw className="h-4 w-4" />}
                        onClick={() => mutate()}
                    >
                        Kjør
                    </Button>
                </div>
            </div>
            {isSuccess && data && (
                <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    {`hentet: ${data.hentet} · oppdatert: ${data.oppdatert}`}
                </p>
            )}
            {error && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
            {drySuccess && dryData && (
                <div className="text-xs bg-blue-50 rounded-lg px-3 py-2 space-y-1.5">
                    <p className="font-medium text-blue-800">
                        Dry run: {dryData.hentet} fra API ({dryData.relevante} relevante) —{' '}
                        {dryData.oppdatert === 0
                            ? 'ingen ville blitt oppdatert'
                            : `${dryData.oppdatert} ville blitt oppdatert`}
                    </p>
                    {dryData.kamper.length > 0 && (
                        <ul className="space-y-0.5">
                            {dryData.kamper.map((k) => (
                                <DryRunScoreKampRad key={k.match_num} kamp={k} />
                            ))}
                        </ul>
                    )}
                    {dryData.kamper.length === 0 && (
                        <p className="text-blue-600">Ingen kamper med status IN_PLAY/PAUSED/FINISHED fra API.</p>
                    )}
                </div>
            )}
            {dryError && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
        </div>
    )
}

function SyncMatchesKnapp() {
    const { mutate, isPending, data, error, isSuccess } = UseMutateAdminCron('sync-matches')
    const {
        mutate: dryMutate,
        isPending: dryPending,
        data: dryData,
        error: dryError,
        isSuccess: drySuccess,
    } = UseDryRunSyncMatches()

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Synk kampoppsett</p>
                    <p className="text-xs text-stone-500">
                        Henter kampoppsett (tidspunkt, lag, runde) fra football-data.org.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="small"
                        loading={dryPending}
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => dryMutate()}
                    >
                        Dry run
                    </Button>
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        icon={<Calendar className="h-4 w-4" />}
                        onClick={() => mutate()}
                    >
                        Kjør
                    </Button>
                </div>
            </div>
            {isSuccess && data && (
                <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    {`hentet: ${data.hentet} · oppdatert: ${data.oppdatert}`}
                </p>
            )}
            {error && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
            {drySuccess && dryData && (
                <div className="text-xs bg-blue-50 rounded-lg px-3 py-2 space-y-1.5">
                    <p className="font-medium text-blue-800">
                        Dry run: {dryData.hentet} kamper hentet —{' '}
                        {dryData.oppdatert === 0 ? 'ingen endringer' : `${dryData.oppdatert} ville blitt oppdatert`}
                    </p>
                    {dryData.endringer.length > 0 && (
                        <ul className="space-y-0.5 text-blue-700">
                            {dryData.endringer.map((e) => (
                                <DryRunEndringRad key={e.match_num} endring={e} />
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {dryError && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
        </div>
    )
}

function SendPåminnelserKnapp() {
    const { mutate, isPending, data, error, isSuccess } = UseMutateAdminCron('send-reminders')
    const {
        mutate: dryMutate,
        isPending: dryPending,
        data: dryData,
        error: dryError,
        isSuccess: drySuccess,
    } = UseDryRunSendReminders()

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Send påminnelser</p>
                    <p className="text-xs text-stone-500">
                        Sender push-påminnelser til brukere med utippede kamper i morgen.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="small"
                        loading={dryPending}
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => dryMutate()}
                    >
                        Dry run
                    </Button>
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        icon={<Bell className="h-4 w-4" />}
                        onClick={() => mutate()}
                    >
                        Kjør
                    </Button>
                </div>
            </div>
            {isSuccess && data && (
                <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    {`kamper i morgen: ${data.kamperIMorgen} · varslet: ${data.brukereVarslet}`}
                </p>
            )}
            {error && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
            {drySuccess && dryData && (
                <div className="text-xs bg-blue-50 rounded-lg px-3 py-2 space-y-1.5">
                    <p className="font-medium text-blue-800">
                        Dry run: {dryData.kamperIMorgen.length} kamper i morgen —{' '}
                        {dryData.brukereVilBliVarslet.length === 0
                            ? 'ingen ville blitt varslet'
                            : `${dryData.brukereVilBliVarslet.length} ville blitt varslet`}
                    </p>
                    {dryData.brukereVilBliVarslet.length > 0 && (
                        <ul className="space-y-0.5">
                            {dryData.brukereVilBliVarslet.map((bruker: DryRunBruker) => (
                                <li key={bruker.id} className="text-blue-800">
                                    <span className="font-medium">{bruker.name}</span>
                                    <span className="text-stone-400 ml-1">({bruker.email})</span>
                                    {' — '}
                                    {bruker.antallUtippet === 1
                                        ? '1 utippet kamp'
                                        : `${bruker.antallUtippet} utippede kamper`}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {dryError && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
        </div>
    )
}

function SendVmStartKnapp() {
    const { mutate, isPending, data, error, isSuccess } = UseMutateAdminCron('send-vm-start')
    const {
        mutate: dryMutate,
        isPending: dryPending,
        data: dryData,
        error: dryError,
        isSuccess: drySuccess,
    } = UseDryRunSendVmStart()

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Send VM-startvarsel</p>
                    <p className="text-xs text-stone-500">Én gang: varsler alle brukere om at VM starter i dag.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="small"
                        loading={dryPending}
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => dryMutate()}
                    >
                        Dry run
                    </Button>
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        icon={<Trophy className="h-4 w-4" />}
                        onClick={() => mutate()}
                    >
                        Kjør
                    </Button>
                </div>
            </div>
            {isSuccess && data && (
                <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    {`varslet: ${(data as { brukereVarslet: number }).brukereVarslet}`}
                </p>
            )}
            {error && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
            {drySuccess && dryData && (
                <div className="text-xs bg-blue-50 rounded-lg px-3 py-2 space-y-1.5">
                    <p className="font-medium text-blue-800">
                        Dry run:{' '}
                        {dryData.brukereVilBliVarslet.length === 0
                            ? 'ingen ville blitt varslet'
                            : `${dryData.brukereVilBliVarslet.length} ville blitt varslet`}
                    </p>
                    {dryData.brukereVilBliVarslet.length > 0 && (
                        <ul className="space-y-0.5">
                            {dryData.brukereVilBliVarslet.map((bruker: VmStartDryRunBruker) => (
                                <li key={bruker.id} className="text-blue-800">
                                    <span className="font-medium">{bruker.name}</span>
                                    <span className="text-stone-400 ml-1">({bruker.email})</span>
                                    <span className="ml-1 font-mono text-[11px] text-stone-400">
                                        [{bruker.language}]
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {dryError && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
        </div>
    )
}

const CronPage: NextPage = () => {
    const { data: me } = UseUser()

    if (!me) return <Spinner />

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-stone-900">Cron-jobber</h1>
            <div className="bp-card">
                <div className="divide-y divide-stone-100">
                    <SyncScoresKnapp />
                    <SyncMatchesKnapp />
                    <SendPåminnelserKnapp />
                    <SendVmStartKnapp />
                </div>
            </div>
        </div>
    )
}

export default CronPage
