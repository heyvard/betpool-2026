import { Bell, X } from 'lucide-react'
import NextLink from 'next/link'
import { useEffect, useState } from 'react'

import { hentAbonnement, pushStøttes } from '../utils/push'

const DISMISS_NØKKEL = 'betpool:varsler-hint-dismissed'

// Liten banner øverst på forsiden som peker brukere mot /varsler. Skjules hvis:
//  - push ikke støttes
//  - brukeren allerede har et abonnement
//  - brukeren har trykket X tidligere (lagret i localStorage)
export function VarslerHint() {
    const [synlig, setSynlig] = useState(false)

    useEffect(() => {
        const sjekk = async () => {
            if (!pushStøttes()) return
            if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_NØKKEL) === '1') return
            if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return
            try {
                const abonnement = await hentAbonnement()
                if (abonnement) return
            } catch {
                // ignorer — vis hintet
            }
            setSynlig(true)
        }
        sjekk()
    }, [])

    if (!synlig) return null

    const lukk = () => {
        localStorage.setItem(DISMISS_NØKKEL, '1')
        setSynlig(false)
    }

    return (
        <div className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-stone-900">Slå på varsler?</p>
                <p className="text-xs text-stone-600">
                    Få påminnelse om kamper du ikke har tippa, og en oppsummering dagen etter.
                </p>
                <NextLink
                    href="/varsler"
                    className="mt-2 inline-flex items-center text-sm font-semibold text-amber-700 hover:text-amber-800"
                >
                    Sett opp →
                </NextLink>
            </div>
            <button
                type="button"
                onClick={lukk}
                aria-label="Lukk"
                className="shrink-0 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
}
