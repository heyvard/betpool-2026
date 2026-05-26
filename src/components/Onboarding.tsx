import React, { useState } from 'react'
import { Goal, ListChecks, Sparkles, Trophy, Zap } from 'lucide-react'

import { useAuthedFetch } from '../auth/authedFetch'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 3-slide overlay som vises for nye brukere før forsiden. Lukkes via "Hopp
 * over" eller "Kom i gang" på siste slide — begge sender PUT /api/v1/me/
 * med { onboarded: true }, som setter onboarded_at i basen.
 */
export function Onboarding({ onFerdig }: { onFerdig: () => void }) {
    const authedFetch = useAuthedFetch()
    const queryClient = useQueryClient()
    const [steg, setSteg] = useState(0)
    const [lagrer, setLagrer] = useState(false)

    const SLIDES = [
        {
            tittel: 'Tipp alle kampene',
            tekst: 'Sett score for hver kamp i VM. Bli mer presis enn vennene dine.',
            visual: <TipsVisual />,
        },
        {
            tittel: 'Bruk jokeren',
            tekst: 'Én joker per runde dobler poengene på din magefølelse-kamp.',
            visual: <JokerVisual />,
        },
        {
            tittel: 'Sjeldne tips teller mer',
            tekst: 'Treffer du en score ingen andre har, gir det ekstra poeng.',
            visual: <ScoreVisual />,
        },
    ] as const

    const aktiv = SLIDES[steg]
    const erSiste = steg === SLIDES.length - 1

    const fullfør = async () => {
        if (lagrer) return
        setLagrer(true)
        try {
            const r = await authedFetch('/api/v1/me/', {
                method: 'PUT',
                body: JSON.stringify({ onboarded: true }),
            })
            if (r.ok) {
                queryClient.invalidateQueries({ queryKey: ['user-me'] }).then()
                onFerdig()
            }
        } finally {
            setLagrer(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-stone-900 text-white">
            <div className="flex flex-1 flex-col items-center justify-center px-6">
                <div className="mb-2">{aktiv.visual}</div>
                <h1 className="mt-8 text-2xl font-bold">{aktiv.tittel}</h1>
                <p className="mt-3 max-w-sm text-center text-stone-300">{aktiv.tekst}</p>
            </div>
            <div className="flex items-center justify-between gap-3 px-6 pb-8">
                <button
                    type="button"
                    onClick={fullfør}
                    disabled={lagrer}
                    className="text-sm text-stone-400 hover:text-stone-200 disabled:opacity-50"
                >
                    Hopp over
                </button>
                <div className="flex gap-2" aria-hidden>
                    {SLIDES.map((_, i) => (
                        <span
                            key={i}
                            className={cn('h-1.5 w-6 rounded-full', i === steg ? 'bg-amber-500' : 'bg-stone-700')}
                        />
                    ))}
                </div>
                <Button
                    variant="accent"
                    onClick={() => (erSiste ? fullfør() : setSteg(steg + 1))}
                    loading={erSiste && lagrer}
                >
                    {erSiste ? 'Kom i gang' : 'Neste'}
                </Button>
            </div>
        </div>
    )
}

function TipsVisual() {
    return (
        <div className="flex h-40 w-40 items-center justify-center rounded-3xl bg-stone-800 ring-1 ring-stone-700">
            <ListChecks className="h-20 w-20 text-amber-400" strokeWidth={1.5} />
        </div>
    )
}

function JokerVisual() {
    return (
        <div className="flex h-40 w-40 flex-col items-center justify-center gap-3 rounded-3xl bg-stone-800 ring-1 ring-stone-700">
            <Zap className="h-16 w-16 fill-amber-400 text-amber-400" strokeWidth={1.5} />
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-stone-900">
                <Zap className="h-3 w-3 fill-current" /> Joker aktiv
            </span>
        </div>
    )
}

function ScoreVisual() {
    return (
        <div className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-3xl bg-stone-800 ring-1 ring-stone-700">
            <div className="flex items-center gap-2 text-xl font-bold">
                <Trophy className="h-6 w-6 text-amber-400" />
                <span className="bp-tabular text-3xl">2–1</span>
                <Goal className="h-6 w-6 text-amber-400" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 ring-1 ring-amber-500/40">
                <Sparkles className="h-3 w-3" /> Sjeldent = mer
            </span>
        </div>
    )
}
