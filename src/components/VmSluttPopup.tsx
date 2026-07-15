import { useEffect, useState } from 'react'
import { MessageSquareHeart, X } from 'lucide-react'
import NextLink from 'next/link'
import dayjs from 'dayjs'

import { useLanguage } from '../i18n/LanguageContext'
import { erTestAuth } from '../utils/erTestAuth'

const STORAGE_KEY = 'bp_vm_slutt_popup_lukket_v1'

// Popupen skal bare vises den siste uka av VM 2026 (finalen er 19. juli).
const VIS_FRA = dayjs('2026-07-14T00:00:00')
const VIS_TIL = dayjs('2026-07-21T23:59:59')

function erIVisningsvinduet(): boolean {
    const nå = dayjs()
    return !nå.isBefore(VIS_FRA) && !nå.isAfter(VIS_TIL)
}

export function VmSluttPopup() {
    const { t } = useLanguage()
    // Standard lukket til vi har rukket å sjekke localStorage på klienten —
    // unngår et hydration-mismatch-glimt av popupen på serverrendret markup.
    const [vis, setVis] = useState(false)

    useEffect(() => {
        const sjekk = async () => {
            // Test-auth-modus (integrasjon/e2e) skal være deterministisk — denne
            // popupen har ingenting med testflytene å gjøre.
            if (erTestAuth() || !erIVisningsvinduet() || localStorage.getItem(STORAGE_KEY)) return
            await Promise.resolve()
            setVis(true)
        }
        sjekk()
    }, [])

    if (!vis) return null

    const lukk = () => {
        localStorage.setItem(STORAGE_KEY, '1')
        setVis(false)
    }

    return (
        <div className="fixed inset-0 z-60 flex items-end bg-stone-900/55 backdrop-blur-[1px]">
            <div className="motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:fade-in relative w-full rounded-t-3xl bg-white p-6 shadow-pop motion-safe:duration-300">
                <button
                    type="button"
                    onClick={lukk}
                    aria-label={t.felles.lukk}
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"
                >
                    <X className="h-4 w-4" />
                </button>

                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 shadow-gold">
                    <MessageSquareHeart className="h-6 w-6 text-stone-900" />
                </span>

                <h2 className="mt-4 text-lg font-extrabold text-stone-900">{t.vmSluttPopup.tittel}</h2>
                <p className="mt-1.5 text-sm text-stone-600">{t.vmSluttPopup.tekst}</p>

                <NextLink
                    href="/tilbakemelding"
                    onClick={lukk}
                    className="bp-btn-primary mt-5 block w-full text-center"
                >
                    {t.vmSluttPopup.knapp}
                </NextLink>
                <button
                    type="button"
                    onClick={lukk}
                    className="mt-3 block w-full text-center text-sm text-stone-500 hover:text-stone-700"
                >
                    {t.vmSluttPopup.ikkeNaa}
                </button>
            </div>
        </div>
    )
}
