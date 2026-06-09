import type { NextPage } from 'next'
import { Spinner } from '../components/loading/Spinner'
import React from 'react'
import { UseUser } from '../queries/useUser'
import { UseMutateAdminCron, UseDryRunSyncMatches, CronJobb, DryRunEndring } from '../queries/mutateAdminCron'
import { Button } from '@/components/ui/button'
import { RefreshCw, Bell, Calendar, Eye } from 'lucide-react'

const ENKEL_JOBBER: { jobb: CronJobb; label: string; beskrivelse: string; ikon: React.ReactNode }[] = [
    {
        jobb: 'sync-scores',
        label: 'Synk resultater',
        beskrivelse: 'Henter live-scores fra football-data.org for pågående og nylig ferdige kamper.',
        ikon: <RefreshCw className="h-4 w-4" />,
    },
    {
        jobb: 'send-reminders',
        label: 'Send påminnelser',
        beskrivelse: 'Sender push-påminnelser til brukere med utippede kamper i morgen.',
        ikon: <Bell className="h-4 w-4" />,
    },
]

function CronJobbKnapp({ jobb, label, beskrivelse, ikon }: (typeof ENKEL_JOBBER)[number]) {
    const { mutate, isPending, data, error, isSuccess } = UseMutateAdminCron(jobb)

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">{label}</p>
                    <p className="text-xs text-stone-500">{beskrivelse}</p>
                </div>
                <Button
                    variant="outline"
                    size="small"
                    loading={isPending}
                    icon={ikon}
                    onClick={() => mutate()}
                    className="shrink-0"
                >
                    Kjør
                </Button>
            </div>
            {isSuccess && data && (
                <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    {Object.entries(data)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                </p>
            )}
            {error && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
        </div>
    )
}

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

const CronPage: NextPage = () => {
    const { data: me } = UseUser()

    if (!me) return <Spinner />

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-stone-900">Cron-jobber</h1>
            <div className="bp-card">
                <div className="divide-y divide-stone-100">
                    <SyncMatchesKnapp />
                    {ENKEL_JOBBER.map((props) => (
                        <CronJobbKnapp key={props.jobb} {...props} />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default CronPage
