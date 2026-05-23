import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LeagueSummary } from '../types/league'

// Bytter mellom hovedligaen og en privat liga i resultattabellen. Lister bare
// ligaer der brukeren faktisk er medlem (ikke åpne invitasjoner).
export function LigaVelger({
    ligaer,
    valgt,
    onVelg,
}: {
    ligaer: LeagueSummary[]
    valgt: string | null
    onVelg: (id: string | null) => void
}) {
    const mine = ligaer.filter((l) => l.my_status === 'medlem')

    return (
        <div className="relative">
            <label htmlFor="liga-velger" className="sr-only">
                Velg liga
            </label>
            <select
                id="liga-velger"
                value={valgt ?? ''}
                onChange={(e) => onVelg(e.target.value || null)}
                className={cn(
                    'h-11 w-full appearance-none rounded-xl border border-stone-300 bg-white pl-3 pr-10 text-sm font-semibold text-stone-900',
                    'transition-shadow focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400',
                )}
            >
                <option value="">🏆 Hovedligaen</option>
                {mine.map((l) => (
                    <option key={l.id} value={l.id}>
                        {l.name}
                    </option>
                ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-stone-400">
                <ChevronDown className="h-4 w-4" />
            </span>
        </div>
    )
}
