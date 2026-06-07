import type { NextPage } from 'next'
import { Spinner } from '../components/loading/Spinner'
import React from 'react'
import { UseUser } from '../queries/useUser'
import { UseMutateAdminCron, CronJobb } from '../queries/mutateAdminCron'
import { Button } from '@/components/ui/button'
import { RefreshCw, Bell, Calendar } from 'lucide-react'

const CRON_JOBBER: { jobb: CronJobb; label: string; beskrivelse: string; ikon: React.ReactNode }[] = [
    {
        jobb: 'sync-scores',
        label: 'Synk resultater',
        beskrivelse: 'Henter live-scores fra football-data.org for pågående og nylig ferdige kamper.',
        ikon: <RefreshCw className="h-4 w-4" />,
    },
    {
        jobb: 'sync-matches',
        label: 'Synk kampoppsett',
        beskrivelse: 'Henter kampoppsett (tidspunkt, lag, runde) fra football-data.org.',
        ikon: <Calendar className="h-4 w-4" />,
    },
    {
        jobb: 'send-reminders',
        label: 'Send påminnelser',
        beskrivelse: 'Sender push-påminnelser til brukere med utippede kamper i morgen.',
        ikon: <Bell className="h-4 w-4" />,
    },
]

function CronJobbKnapp({ jobb, label, beskrivelse, ikon }: (typeof CRON_JOBBER)[number]) {
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

const CronPage: NextPage = () => {
    const { data: me } = UseUser()

    if (!me) return <Spinner />

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-stone-900">Cron-jobber</h1>
            <div className="bp-card">
                <div className="divide-y divide-stone-100">
                    {CRON_JOBBER.map((props) => (
                        <CronJobbKnapp key={props.jobb} {...props} />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default CronPage
