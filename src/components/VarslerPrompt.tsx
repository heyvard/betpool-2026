import { Bell, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'

import { abonner, pushStøttes } from '../utils/push'
import { useAuthedFetch } from '../auth/authedFetch'
import { Button } from '@/components/ui/button'

const STATE_NØKKEL = 'betpool:varsler-prompt'
// betpool:vis-varsler-prompt event dispatches åpning av modalen.
export const VIS_EVENT = 'betpool:vis-varsler-prompt'

// True hvis brukeren ikke har gjort et eksplisitt valg og minst 7 dager har
// gått siden vi sist prompttet. Returnerer false i SSR.
export function brukerKanPrompttes(): boolean {
    if (typeof window === 'undefined') return false
    if (!pushStøttes()) return false
    if (Notification.permission !== 'default') return false
    const state = localStorage.getItem(STATE_NØKKEL)
    if (state === 'accepted' || state === 'declined') return false
    if (!state) return true
    return dayjs().diff(dayjs(state), 'day') >= 7
}

/**
 * Modal som spør om varsler. Mounted globalt i _app.tsx og åpnes av et
 * `betpool:vis-varsler-prompt`-event fra hvor som helst i appen — typisk
 * etter at en bruker lagrer sitt første tipp.
 */
export function VarslerPrompt() {
    const authedFetch = useAuthedFetch()
    const [synlig, setSynlig] = useState(false)
    const [jobber, setJobber] = useState(false)
    const [feil, setFeil] = useState<string | null>(null)

    useEffect(() => {
        const handler = () => setSynlig(true)
        window.addEventListener(VIS_EVENT, handler)
        return () => window.removeEventListener(VIS_EVENT, handler)
    }, [])

    if (!synlig) return null

    const ikkeNå = () => {
        localStorage.setItem(STATE_NØKKEL, dayjs().toISOString())
        setSynlig(false)
    }

    const aksepter = async () => {
        setFeil(null)
        setJobber(true)
        try {
            const sub = await abonner()
            await authedFetch('/api/v1/me/push-subscription', {
                method: 'PUT',
                body: JSON.stringify(sub.toJSON()),
            })
            localStorage.setItem(STATE_NØKKEL, 'accepted')
            setSynlig(false)
        } catch (e) {
            const m = e instanceof Error ? e.message : String(e)
            // Hvis brukeren avslo i den native dialogen, behandle det som varig nei.
            if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
                localStorage.setItem(STATE_NØKKEL, 'declined')
                setSynlig(false)
                return
            }
            setFeil(m)
        } finally {
            setJobber(false)
        }
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="varsler-prompt-tittel"
            className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/60 px-4 pb-6 pt-20 sm:items-center sm:p-6"
        >
            <div className="relative w-full max-w-sm rounded-2xl bg-amber-50 p-6 shadow-xl ring-1 ring-amber-200">
                <button
                    type="button"
                    onClick={ikkeNå}
                    aria-label="Lukk"
                    className="absolute right-3 top-3 rounded-md p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="flex flex-col items-center text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-200 text-amber-800">
                        <Bell className="h-6 w-6" />
                    </span>
                    <h2 id="varsler-prompt-tittel" className="mt-3 text-base font-bold text-stone-900">
                        Slå på varsler?
                    </h2>
                    <p className="mt-1 text-sm text-stone-700">
                        Få påminnelse om kamper du ikke har tippa, og en oppsummering dagen etter.
                    </p>
                </div>

                {feil && (
                    <p role="alert" className="mt-3 text-xs text-red-700">
                        {feil}
                    </p>
                )}

                <div className="mt-5 flex flex-col gap-2">
                    <Button variant="accent" onClick={aksepter} loading={jobber}>
                        Slå på varsler
                    </Button>
                    <Button variant="ghost" onClick={ikkeNå}>
                        Ikke nå
                    </Button>
                </div>
            </div>
        </div>
    )
}
