import type { NextPage } from 'next'
import { Spinner } from '../components/loading/Spinner'
import React, { useState, useMemo } from 'react'
import { UseUsers } from '../queries/useUsers'
import { UseMutateUser, UseSletteUser } from '../queries/mutateUser'
import { UseUser } from '../queries/useUser'
import { UserForAdmin } from '../types/types'
import { User } from '../types/user'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, ChevronsUpDown, Trash2, Search, X } from 'lucide-react'
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getExpandedRowModel,
    flexRender,
    createColumnHelper,
    SortingState,
    ColumnFiltersState,
    ExpandedState,
    FilterFn,
} from '@tanstack/react-table'

function initialer(navn: string): string {
    const deler = navn.trim().split(/\s+/).filter(Boolean)
    if (deler.length === 0) return '?'
    if (deler.length === 1) return deler[0].slice(0, 2).toUpperCase()
    return (deler[0][0] + deler[deler.length - 1][0]).toUpperCase()
}

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

function formaterTidspunkt(isoStreng: string): string {
    const d = new Date(isoStreng)
    return d.toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })
}

function RolleChip({ label }: { label: string }) {
    return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            {label}
        </span>
    )
}

function StatusChip({ label, aktiv }: { label: string; aktiv: boolean }) {
    return (
        <span
            className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                aktiv ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-400',
            )}
        >
            {label}
        </span>
    )
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
        <div className="flex items-center justify-between py-2">
            <span className="text-sm text-stone-700">{label}</span>
            <Switch checked={checked} size="small" loading={loading} onCheckedChange={onToggle} />
        </div>
    )
}

function ExpandertRad({ user, me }: { user: UserForAdmin; me: User }) {
    const { mutate, isPending } = UseMutateUser(user.id)
    const { mutate: slettBruker, isPending: isPendingSletting, error: sletteError } = UseSletteUser(user.id)

    const sistBett = user.last_bet_at ? formaterTidspunkt(user.last_bet_at) : null

    return (
        <div className="px-4 pb-3 pt-1 bg-stone-50 border-t border-stone-100 space-y-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div>
                    <span className="text-stone-500">Bett:</span>{' '}
                    <span className="bp-tabular font-medium text-stone-800">{user.bet_count}</span>
                </div>
                <div>
                    <span className="text-stone-500">Push-enheter:</span>{' '}
                    <span className="bp-tabular font-medium text-stone-800">{user.device_count}</span>
                </div>
                {sistBett && (
                    <div className="col-span-2">
                        <span className="text-stone-500">Sist bett:</span>{' '}
                        <span className="bp-tabular text-stone-700">{sistBett}</span>
                    </div>
                )}
                {innloggingsmetodeTekst(user.sign_in_provider) && (
                    <div className="col-span-2">
                        <span className="text-stone-500">Innlogging:</span>{' '}
                        <span className="text-stone-700">{innloggingsmetodeTekst(user.sign_in_provider)}</span>
                    </div>
                )}
            </div>

            {me.superadmin && (
                <div className="divide-y divide-stone-200 border-t border-stone-200 pt-2">
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
                        <div className="pt-2">
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
                                <p className="mt-1 text-xs text-red-700">Kunne ikke lagre — prøv igjen.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

type FilterType = 'alle' | 'aktiv' | 'inaktiv' | 'betalt' | 'ikke-betalt'

const globalFilterFn: FilterFn<UserForAdmin> = (row, _columnId, filterValue: string) => {
    const søk = filterValue.toLowerCase()
    return row.original.name.toLowerCase().includes(søk) || row.original.email.toLowerCase().includes(søk)
}

const columnHelper = createColumnHelper<UserForAdmin>()

function SorterIkon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
    if (sorted === 'asc') return <ChevronUp className="h-3.5 w-3.5 shrink-0" />
    if (sorted === 'desc') return <ChevronDown className="h-3.5 w-3.5 shrink-0" />
    return <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-stone-400" />
}

function BrukerTabell({ brukere, me }: { brukere: UserForAdmin[]; me: User }) {
    const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
    const [globalFilter, setGlobalFilter] = useState('')
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [expanded, setExpanded] = useState<ExpandedState>({})
    const [filterType, setFilterType] = useState<FilterType>('alle')

    const filtrertData = useMemo(() => {
        switch (filterType) {
            case 'aktiv':
                return brukere.filter((u) => u.active)
            case 'inaktiv':
                return brukere.filter((u) => !u.active)
            case 'betalt':
                return brukere.filter((u) => u.paid)
            case 'ikke-betalt':
                return brukere.filter((u) => !u.paid)
            default:
                return brukere
        }
    }, [brukere, filterType])

    const columns = useMemo(
        () => [
            columnHelper.accessor('name', {
                header: 'Navn',
                cell: (info) => {
                    const user = info.row.original
                    const roller = [
                        user.superadmin && 'Super',
                        user.scoreadmin && 'Score',
                        user.paymentadmin && 'Payment',
                    ].filter(Boolean) as string[]
                    return (
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-stone-700 to-stone-900 text-xs font-semibold text-white">
                                {initialer(user.name)}
                            </span>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium text-stone-900 text-sm leading-tight truncate max-w-[120px] sm:max-w-none">
                                        {user.name}
                                    </span>
                                    {!user.active && (
                                        <span className="shrink-0 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-stone-500">
                                            Inaktiv
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-stone-500 truncate max-w-[140px] sm:max-w-none">
                                    {user.email}
                                </p>
                                {roller.length > 0 && (
                                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                                        {roller.map((r) => (
                                            <RolleChip key={r} label={r} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                },
                sortingFn: (a, b) => a.original.name.localeCompare(b.original.name, 'nb'),
                filterFn: globalFilterFn,
            }),
            columnHelper.accessor('bet_count', {
                header: 'Bett',
                cell: (info) => <span className="bp-tabular text-sm text-stone-700">{info.getValue()}</span>,
                size: 60,
            }),
            columnHelper.accessor('earliest_unbet_match', {
                header: 'Neste utippet',
                cell: (info) => {
                    const val = info.getValue()
                    if (!val)
                        return (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-800">
                                Alt tippet
                            </span>
                        )
                    const d = new Date(val)
                    const dag = d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
                    const tid = d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
                    return (
                        <span className="bp-tabular text-xs font-medium text-amber-700 whitespace-nowrap">
                            {dag} {tid}
                        </span>
                    )
                },
                sortingFn: (a, b) => {
                    const av = a.original.earliest_unbet_match
                    const bv = b.original.earliest_unbet_match
                    if (!av && !bv) return 0
                    if (!av) return 1
                    if (!bv) return -1
                    return new Date(av).getTime() - new Date(bv).getTime()
                },
            }),
            columnHelper.accessor('paid', {
                header: 'Betalt',
                cell: (info) => (
                    <StatusChip label={info.getValue() ? 'Betalt' : 'Ikke betalt'} aktiv={info.getValue()} />
                ),
                sortingFn: (a, b) => Number(a.original.paid) - Number(b.original.paid),
                size: 90,
            }),
            columnHelper.display({
                id: 'expand',
                header: '',
                cell: (info) => (
                    <button
                        onClick={info.row.getToggleExpandedHandler()}
                        className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-stone-100 text-stone-500"
                        aria-label={info.row.getIsExpanded() ? 'Lukk' : 'Vis detaljer'}
                    >
                        {info.row.getIsExpanded() ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </button>
                ),
                size: 44,
            }),
        ],
        [],
    )

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data: filtrertData,
        columns,
        state: { sorting, globalFilter, columnFilters, expanded },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onColumnFiltersChange: setColumnFilters,
        onExpandedChange: setExpanded,
        globalFilterFn,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getRowCanExpand: () => true,
    })

    const filterKnapper: { type: FilterType; label: string }[] = [
        { type: 'alle', label: 'Alle' },
        { type: 'aktiv', label: 'Aktive' },
        { type: 'inaktiv', label: 'Inaktive' },
        { type: 'betalt', label: 'Betalt' },
        { type: 'ikke-betalt', label: 'Ikke betalt' },
    ]

    return (
        <div className="space-y-3">
            {/* Søk */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                <input
                    type="text"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    placeholder="Søk navn eller e-post…"
                    className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-8 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {globalFilter && (
                    <button
                        onClick={() => setGlobalFilter('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Filterknapper */}
            <div className="flex gap-1.5 flex-wrap">
                {filterKnapper.map(({ type, label }) => (
                    <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={cn(
                            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                            filterType === type
                                ? 'bg-stone-800 text-white'
                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Antall */}
            <p className="text-xs text-stone-500">
                {table.getFilteredRowModel().rows.length} av {brukere.length} brukere
            </p>

            {/* Tabell */}
            <div className="bp-card overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-0 border-collapse">
                        <thead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id} className="border-b border-stone-100">
                                    {headerGroup.headers.map((header) => {
                                        const canSort = header.column.getCanSort()
                                        const sorted = header.column.getIsSorted()
                                        return (
                                            <th
                                                key={header.id}
                                                style={{ width: header.column.columnDef.size }}
                                                className={cn(
                                                    'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500 select-none',
                                                    canSort && 'cursor-pointer hover:text-stone-800',
                                                )}
                                                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                                            >
                                                {header.isPlaceholder ? null : (
                                                    <div className="flex items-center gap-1">
                                                        {flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext(),
                                                        )}
                                                        {canSort && <SorterIkon sorted={sorted} />}
                                                    </div>
                                                )}
                                            </th>
                                        )
                                    })}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {table.getRowModel().rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={columns.length}
                                        className="px-4 py-8 text-center text-sm text-stone-400"
                                    >
                                        Ingen brukere funnet.
                                    </td>
                                </tr>
                            )}
                            {table.getRowModel().rows.map((row) => (
                                <React.Fragment key={row.id}>
                                    <tr
                                        className={cn(
                                            'transition-colors',
                                            row.getIsExpanded() ? 'bg-stone-50' : 'hover:bg-stone-50/50',
                                            !row.original.active && 'opacity-60',
                                        )}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td key={cell.id} className="px-3 py-2.5 align-middle">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                    {row.getIsExpanded() && (
                                        <tr>
                                            <td colSpan={columns.length} className="p-0">
                                                <ExpandertRad user={row.original} me={me} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
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

    return (
        <div className="space-y-3">
            <h1 className="text-2xl font-bold text-stone-900">Brukere</h1>
            <BrukerTabell brukere={data} me={me} />
        </div>
    )
}

export default Brukere
