import { useEffect, useState } from 'react'
import { Eye, Repeat2, X } from 'lucide-react'
import dayjs from 'dayjs'
import nb from 'dayjs/locale/nb'
import fr from 'dayjs/locale/fr'
import NextLink from 'next/link'

import { useLanguage } from '../i18n/LanguageContext'
import { tx } from '../i18n/interpolate'

const STORAGE_KEY = 'bp_endrevindu_popup_lukket_v1'

export function EndrevinduPopup({
    endrevindu,
    endrevinduSlutt,
}: {
    endrevindu: boolean
    endrevinduSlutt: dayjs.Dayjs | null
}) {
    const { t, locale } = useLanguage()
    const dayjsLocale = locale === 'fr' ? fr : nb
    // Standard lukket til vi har rukket å sjekke localStorage på klienten —
    // unngår et hydration-mismatch-glimt av popupen på serverrendret markup.
    const [vis, setVis] = useState(false)

    useEffect(() => {
        const sjekk = async () => {
            if (!endrevindu || localStorage.getItem(STORAGE_KEY)) return
            await Promise.resolve()
            setVis(true)
        }
        sjekk()
    }, [endrevindu])

    if (!vis) return null

    const lukk = () => {
        localStorage.setItem(STORAGE_KEY, '1')
        setVis(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end bg-stone-900/55 backdrop-blur-[1px]">
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
                    <Repeat2 className="h-6 w-6 text-stone-900" />
                </span>

                <h2 className="mt-4 text-lg font-extrabold text-stone-900">{t.hjem.endrevinduPopupTittel}</h2>
                <p className="mt-1.5 text-sm text-stone-600">
                    {tx(t.hjem.endrevinduPopupTekst, {
                        dato: endrevinduSlutt?.locale(dayjsLocale).format('dddd D. MMM [kl] HH:mm') ?? '',
                    })}
                </p>

                <ul className="mt-4 space-y-2.5">
                    <li className="flex items-center gap-2.5 text-sm text-stone-700">
                        <span className="chip-halved shrink-0">½</span>
                        {t.hjem.endrevinduPopupHalvering}
                    </li>
                    <li className="flex items-center gap-2.5 text-sm text-stone-700">
                        <Eye className="h-4 w-4 shrink-0 text-amber-600" />
                        {t.hjem.endrevinduPopupSynlig}
                    </li>
                </ul>

                <button type="button" onClick={lukk} className="bp-btn-primary mt-5 w-full">
                    {t.hjem.endrevinduPopupKnapp}
                </button>
                <NextLink href="/regler" className="mt-3 block text-center text-sm text-stone-500 hover:text-stone-700">
                    {t.hjem.endrevinduPopupLesMer}
                </NextLink>
            </div>
        </div>
    )
}
