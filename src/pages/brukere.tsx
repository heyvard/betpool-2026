import type { NextPage } from 'next'
import { Spinner } from '../components/loading/Spinner'
import React from 'react'
import { UseUsers } from '../queries/useUsers'
import { UseMutateUser, UseSletteUser } from '../queries/mutateUser'
import { UseUser } from '../queries/useUser'
import { UseMutateAdminCron, CronJobb } from '../queries/mutateAdminCron'
import { UserForAdmin } from '../types/types'
import { User } from '../types/user'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RefreshCw, Bell, Calendar, Smartphone, Trash2 } from 'lucide-react'

function initialer(navn: string): string {
    const deler = navn.trim().split(/\s+/).filter(Boolean)
    if (deler.length === 0) return '?'
    if (deler.length === 1) return deler[0].slice(0, 2).toUpperCase()
    return (deler[0][0] + deler[deler.length - 1][0]).toUpperCase()
}

// Pent navn for innloggingsmetoden lagret som rå Firebase-claim. Returnerer null
// for ukjente/manglende verdier slik at chipen ikke vises.
function innloggingsmetodeTekst(provider: string | null): string | null {
    switch (provider) {
        case 'google.com':
            return 'Google'
        case 'password':
            return 'E-post'
        default:
            return null
    }
}

function InnstillingsRad({
    label,
    checked,
    loading,
    onToggle,
}: {
    label: string
    checked: boolean
    loading: boolean
    onToggle: () => void
}) {
    return (
        <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-stone-700">{label}</span>
            <Switch checked={checked} size="small" loading={loading} onCheckedChange={onToggle} />
        </div>
    )
}

function VarselChip({ label, på, dempet }: { label: string; på: boolean; dempet?: boolean }) {
    return (
        <span
            className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                på && !dempet && 'bg-green-100 text-green-800',
                på && dempet && 'bg-stone-100 text-stone-500',
                !på && 'bg-stone-100 text-stone-400 line-through',
            )}
        >
            {label}
        </span>
    )
}

function PushSeksjon({ user }: { user: UserForAdmin }) {
    const harEnhet = user.device_count > 0
    const enhetTekst = harEnhet
        ? `${user.device_count} ${user.device_count === 1 ? 'push-enhet' : 'push-enheter'}`
        : 'Ingen push-enheter'

    return (
        <div className="py-2.5">
            <div className="flex items-center gap-1.5 text-sm">
                <Smartphone className={cn('h-4 w-4 shrink-0', harEnhet ? 'text-stone-600' : 'text-stone-400')} />
                <span className={harEnhet ? 'text-stone-700' : 'text-stone-400'}>{enhetTekst}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
                <VarselChip label="Generelt" på={user.notif_general} dempet={!harEnhet} />
                <VarselChip label="Påminnelser" på={user.notif_reminders} dempet={!harEnhet} />
                <VarselChip label="Oppsummering" på={user.notif_summary} dempet={!harEnhet} />
            </div>
        </div>
    )
}

function BrukerView({ me, user }: { user: UserForAdmin; me: User }) {
    const { mutate, isPending } = UseMutateUser(user.id)
    const { mutate: slettBruker, isPending: isPendingSletting, error: sletteError } = UseSletteUser(user.id)

    const roller = [
        user.superadmin && 'Superadmin',
        user.scoreadmin && 'Scoreadmin',
        user.paymentadmin && 'Paymentadmin',
    ].filter(Boolean) as string[]

    return (
        <div
            className={cn(
                'bg-white rounded-xl shadow-xs ring-1 ring-stone-200/70 overflow-hidden',
                !user.active && 'opacity-60',
            )}
        >
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-stone-700 to-stone-900 text-sm font-semibold text-white">
                    {initialer(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-stone-900">{user.name}</span>
                        {!user.active && (
                            <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                                Inaktiv
                            </span>
                        )}
                    </div>
                    <p className="truncate text-xs text-stone-500">{user.email}</p>
                    {(roller.length > 0 || innloggingsmetodeTekst(user.sign_in_provider)) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {roller.map((rolle) => (
                                <span
                                    key={rolle}
                                    className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                                >
                                    {rolle}
                                </span>
                            ))}
                            {innloggingsmetodeTekst(user.sign_in_provider) && (
                                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                                    {innloggingsmetodeTekst(user.sign_in_provider)}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-stone-100 divide-y divide-stone-100 px-4">
                <PushSeksjon user={user} />
                {me.superadmin && (
                    <>
                        <InnstillingsRad
                            label="Scoreadmin"
                            checked={user.scoreadmin}
                            loading={isPending}
                            onToggle={() => mutate({ request: { scoreadmin: !user.scoreadmin } })}
                        />
                        <InnstillingsRad
                            label="Paymentadmin"
                            checked={user.paymentadmin}
                            loading={isPending}
                            onToggle={() => mutate({ request: { paymentadmin: !user.paymentadmin } })}
                        />
                        <InnstillingsRad
                            label="Aktiv"
                            checked={user.active}
                            loading={isPending}
                            onToggle={() => mutate({ request: { active: !user.active } })}
                        />
                        {!user.active && me.id !== user.id && (
                            <div className="py-2.5">
                                <Button
                                    variant="ghost"
                                    size="small"
                                    loading={isPendingSletting}
                                    icon={<Trash2 className="h-4 w-4" />}
                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                `Er du sikker på at du vil slette ${user.name}? Dette kan ikke angres.`,
                                            )
                                        ) {
                                            slettBruker()
                                        }
                                    }}
                                >
                                    Slett bruker
                                </Button>
                                {sletteError != null && (
                                    <p className="mt-1.5 text-xs text-red-700">Kunne ikke lagre — prøv igjen.</p>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

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

function CronJobber() {
    return (
        <div className="bp-card">
            <p className="bp-overline mb-3">Cron-jobber</p>
            <div className="divide-y divide-stone-100">
                {CRON_JOBBER.map((props) => (
                    <CronJobbKnapp key={props.jobb} {...props} />
                ))}
            </div>
        </div>
    )
}

const Brukere: NextPage = () => {
    const { data } = UseUsers()
    const { data: me } = UseUser()

    if (!data || !me) {
        return <Spinner />
    }

    const sortert = [...data].sort((a, b) => a.name.localeCompare(b.name, 'nb'))

    return (
        <div className="space-y-3">
            <h1 className="text-2xl font-bold text-stone-900">Brukere</h1>
            {me.superadmin && <CronJobber />}
            {sortert.map((user) => (
                <BrukerView key={user.id} user={user} me={me} />
            ))}
        </div>
    )
}

export default Brukere
