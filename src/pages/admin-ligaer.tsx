import type { NextPage } from 'next'
import React, { useState } from 'react'
import { Spinner } from '../components/loading/Spinner'
import { UseUser } from '../queries/useUser'
import { UseAdminLigaer, AdminLiga } from '../queries/useAdminLigaer'
import { LeagueMember } from '../types/league'
import { ChevronDown, ChevronUp, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

function StatusChip({ status }: { status: LeagueMember['status'] }) {
    return (
        <span
            className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                status === 'invitert' ? 'bg-stone-100 text-stone-500' : 'bg-green-100 text-green-800',
            )}
        >
            {status === 'invitert' ? 'Invitert' : 'Medlem'}
        </span>
    )
}

function BetaltChip({ paid }: { paid: boolean }) {
    return (
        <span
            className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                paid ? 'bp-chip-green' : 'bg-stone-100 text-stone-400',
            )}
        >
            {paid ? 'Betalt' : 'Ikke betalt'}
        </span>
    )
}

function LigaKort({ liga }: { liga: AdminLiga }) {
    const [åpen, setÅpen] = useState(false)
    const antallMedlemmer = liga.members.filter((m) => m.status === 'medlem').length
    const antallInvitert = liga.members.filter((m) => m.status === 'invitert').length

    return (
        <div className="bp-card overflow-hidden p-0">
            <button
                className="w-full px-4 py-3.5 text-left hover:bg-stone-50 transition-colors"
                onClick={() => setÅpen((v) => !v)}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-stone-900 truncate">{liga.name}</span>
                            {liga.innsats != null && <span className="bp-chip-gold shrink-0">{liga.innsats} kr</span>}
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">Vert: {liga.owner_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="flex items-center gap-1 text-sm text-stone-600">
                            <Users className="h-4 w-4" />
                            <span className="bp-tabular">
                                {antallMedlemmer}
                                {antallInvitert > 0 && <span className="text-stone-400"> +{antallInvitert}</span>}
                            </span>
                        </span>
                        {åpen ? (
                            <ChevronUp className="h-4 w-4 text-stone-400" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-stone-400" />
                        )}
                    </div>
                </div>
            </button>

            {åpen && (
                <div className="border-t border-stone-100">
                    {liga.members.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-stone-500">Ingen medlemmer.</p>
                    ) : (
                        <div className="divide-y divide-stone-100">
                            {liga.members.map((m) => (
                                <div key={m.user_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                                    <span className="text-sm text-stone-800 truncate">{m.name}</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <StatusChip status={m.status} />
                                        {liga.innsats != null && <BetaltChip paid={m.paid} />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

const AdminLigaer: NextPage = () => {
    const { data: me } = UseUser()
    const { data: ligaer, isLoading } = UseAdminLigaer()

    if (!me?.superadmin) {
        return <p className="text-stone-500 text-sm mt-8 text-center">Ingen tilgang.</p>
    }

    if (isLoading || !ligaer) {
        return <Spinner />
    }

    return (
        <div className="space-y-3">
            <div className="flex items-baseline justify-between">
                <h1 className="text-2xl font-bold text-stone-900">Private ligaer</h1>
                <span className="text-sm text-stone-500 bp-tabular">{ligaer.length} ligaer</span>
            </div>

            {ligaer.length === 0 ? (
                <div className="bp-card text-sm text-stone-500">Ingen private ligaer er opprettet ennå.</div>
            ) : (
                ligaer.map((liga) => <LigaKort key={liga.id} liga={liga} />)
            )}
        </div>
    )
}

export default AdminLigaer
