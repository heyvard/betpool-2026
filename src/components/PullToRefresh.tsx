import React, { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

// Hvor langt (px) man må dra for å utløse en oppdatering
const TERSKEL = 70
// Maks visuell forskyvning av dra-indikatoren
const MAKS_DRA = 110
// Demping av fingerbevegelsen så draget føles elastisk
const DEMPING = 0.5

/**
 * Wrapper som gir «dra ned for å oppdatere» på mobil. Når man drar siden ned
 * fra toppen nullstilles all server-state i React Query (`resetQueries`), slik
 * at hver side viser sine egne skeletons/spinnere mens dataene hentes på nytt.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient()
    const startY = useRef<number | null>(null)
    const [dra, setDra] = useState(0)
    const [drar, setDrar] = useState(false)
    const [oppdaterer, setOppdaterer] = useState(false)

    const onTouchStart = useCallback(
        (e: React.TouchEvent) => {
            // Start kun gesten når siden er scrollet helt til topps
            const engasjert = window.scrollY <= 0 && !oppdaterer
            startY.current = engasjert ? e.touches[0].clientY : null
            setDrar(engasjert)
        },
        [oppdaterer],
    )

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (startY.current === null) return
        const delta = e.touches[0].clientY - startY.current
        // Reager kun på nedover-dra
        setDra(delta > 0 ? Math.min(delta * DEMPING, MAKS_DRA) : 0)
    }, [])

    const onTouchEnd = useCallback(async () => {
        if (startY.current === null) return
        startY.current = null
        setDrar(false)
        if (dra < TERSKEL || oppdaterer) {
            setDra(0)
            return
        }
        setOppdaterer(true)
        setDra(TERSKEL)
        try {
            // Nullstill all server-state. Da blir `data` undefined igjen, og hver
            // side viser sine egne skeletons/spinnere mens den henter på nytt.
            await queryClient.resetQueries()
        } finally {
            setOppdaterer(false)
            setDra(0)
        }
    }, [dra, oppdaterer, queryClient])

    const klar = dra >= TERSKEL

    return (
        <div className="min-h-screen" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div
                className="flex items-center justify-center overflow-hidden"
                style={{ height: dra, transition: drar ? undefined : 'height 0.2s ease' }}
            >
                <RefreshCw
                    className={cn(
                        'w-6 h-6 transition-colors',
                        oppdaterer && 'animate-spin',
                        klar ? 'text-amber-500' : 'text-stone-400',
                    )}
                    style={{
                        opacity: Math.min(dra / TERSKEL, 1),
                        transform: oppdaterer ? undefined : `rotate(${dra * 2.4}deg)`,
                    }}
                />
            </div>
            {children}
        </div>
    )
}
