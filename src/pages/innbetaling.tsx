import type { NextPage } from 'next'
import { Spinner } from '../components/loading/Spinner'
import React from 'react'
import { UseUsers } from '../queries/useUsers'
import { UseMutateUser } from '../queries/mutateUser'
import { UseUser } from '../queries/useUser'
import { UserForAdmin } from '../types/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

function initialer(navn: string): string {
    const deler = navn.trim().split(/\s+/).filter(Boolean)
    if (deler.length === 0) return '?'
    if (deler.length === 1) return deler[0].slice(0, 2).toUpperCase()
    return (deler[0][0] + deler[deler.length - 1][0]).toUpperCase()
}

function BrukerRad({ user }: { user: UserForAdmin }) {
    const { mutate, isPending } = UseMutateUser(user.id)

    return (
        <div
            className={cn(
                'flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-xs ring-1 transition-all duration-200',
                user.paid ? 'ring-green-200/60' : 'ring-amber-300/80',
            )}
        >
            <span
                className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white',
                    user.paid
                        ? 'bg-linear-to-br from-green-600 to-green-800'
                        : 'bg-linear-to-br from-amber-500 to-amber-700',
                )}
            >
                {initialer(user.name)}
            </span>

            <div className="min-w-0 flex-1">
                <p className={cn('truncate font-semibold', user.paid ? 'text-stone-500' : 'text-stone-900')}>
                    {user.name}
                </p>
                <p className="truncate text-xs text-stone-400">{user.email}</p>
            </div>

            {user.paid ? (
                <div className="flex items-center gap-3 shrink-0">
                    <span className="bp-chip-green">
                        <Check className="h-3.5 w-3.5" />
                        Betalt
                    </span>
                    <button
                        onClick={() => mutate({ request: { paid: false } })}
                        disabled={isPending}
                        className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors disabled:opacity-40"
                    >
                        Angre
                    </button>
                </div>
            ) : (
                <Button
                    variant="accent"
                    size="small"
                    loading={isPending}
                    icon={<Check className="h-3.5 w-3.5" />}
                    onClick={() => mutate({ request: { paid: true } })}
                    className="shrink-0"
                >
                    Betalt
                </Button>
            )}
        </div>
    )
}

const Innbetaling: NextPage = () => {
    const { data } = UseUsers()
    const { data: me } = UseUser()

    if (!data || !me) {
        return <Spinner />
    }

    // Kun hovedliga-deltakere skylder hovedliga-innskuddet. De som har valgt
    // bort hovedligaen spores ikke her.
    const aktive = data.filter((u) => u.active && u.i_hovedliga)
    const ikkeBetalt = [...aktive].filter((u) => !u.paid).sort((a, b) => a.name.localeCompare(b.name, 'nb'))
    const betalt = [...aktive].filter((u) => u.paid).sort((a, b) => a.name.localeCompare(b.name, 'nb'))

    const antallBetalt = betalt.length
    const antallTotalt = aktive.length
    const prosent = antallTotalt > 0 ? Math.round((antallBetalt / antallTotalt) * 100) : 0

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-stone-900">Innbetalinger</h1>
                <p className="mt-0.5 text-sm text-stone-500">
                    {antallBetalt} av {antallTotalt} har betalt
                </p>
                <div className="mt-3 h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-green-500 transition-all duration-500"
                        style={{ width: `${prosent}%` }}
                    />
                </div>
            </div>

            {ikkeBetalt.length > 0 && (
                <div className="space-y-2">
                    <p className="bp-overline">Ikke betalt ({ikkeBetalt.length})</p>
                    {ikkeBetalt.map((user) => (
                        <BrukerRad key={user.id} user={user} />
                    ))}
                </div>
            )}

            {betalt.length > 0 && (
                <div className="space-y-2">
                    <p className="bp-overline">Betalt ({betalt.length})</p>
                    {betalt.map((user) => (
                        <BrukerRad key={user.id} user={user} />
                    ))}
                </div>
            )}

            {aktive.length === 0 && <p className="py-8 text-center text-sm text-stone-500">Ingen aktive brukere</p>}
        </div>
    )
}

export default Innbetaling
