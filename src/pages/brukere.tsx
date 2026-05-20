import type { NextPage } from 'next'
import { Spinner } from '../components/loading/Spinner'
import React from 'react'
import { UseUsers } from '../queries/useUsers'
import { UseMutateUser } from '../queries/mutateUser'
import { UseUser } from '../queries/useUser'
import { UserForAdmin } from '../types/types'
import { User } from '../types/user'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { Check, Clock } from 'lucide-react'

function initialer(navn: string): string {
    const deler = navn.trim().split(/\s+/).filter(Boolean)
    if (deler.length === 0) return '?'
    if (deler.length === 1) return deler[0].slice(0, 2).toUpperCase()
    return (deler[0][0] + deler[deler.length - 1][0]).toUpperCase()
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

function BrukerView({ me, user }: { user: UserForAdmin; me: User }) {
    const { mutate, isPending } = UseMutateUser(user.id)

    const roller = [
        user.superadmin && 'Superadmin',
        user.scoreadmin && 'Scoreadmin',
        user.paymentadmin && 'Paymentadmin',
    ].filter(Boolean) as string[]

    return (
        <div
            className={cn(
                'bg-white rounded-xl shadow-sm ring-1 ring-stone-200/70 overflow-hidden',
                !user.active && 'opacity-60',
            )}
        >
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-700 to-stone-900 text-sm font-semibold text-white">
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
                    {roller.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {roller.map((rolle) => (
                                <span
                                    key={rolle}
                                    className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                                >
                                    {rolle}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <span
                    className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                        user.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
                    )}
                >
                    {user.paid ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    {user.paid ? 'Betalt' : 'Ikke betalt'}
                </span>
            </div>

            <div className="border-t border-stone-100 divide-y divide-stone-100 px-4">
                <InnstillingsRad
                    label="Betalt"
                    checked={user.paid}
                    loading={isPending}
                    onToggle={() => mutate({ request: { paid: !user.paid } })}
                />
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
                    </>
                )}
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
    const antallBetalt = data.filter((u) => u.paid).length

    return (
        <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
                <h1 className="text-2xl font-bold text-stone-900">Brukere</h1>
                <span className="shrink-0 text-sm text-stone-500">
                    {antallBetalt} av {data.length} har betalt
                </span>
            </div>
            {sortert.map((user) => (
                <BrukerView key={user.id} user={user} me={me} />
            ))}
        </div>
    )
}

export default Brukere
