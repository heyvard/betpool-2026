import { ArrowRight, TriangleAlert } from 'lucide-react'

import { useLanguage } from '../i18n/LanguageContext'
import { tx } from '../i18n/interpolate'

interface Verdi {
    label: string
    flagg?: string
}

export function BekreftBytteModal({
    apen,
    type,
    fraVerdi,
    tilVerdi,
    onBekreft,
    onAvbryt,
    lagrer,
}: {
    apen: boolean
    type: 'vinner' | 'toppscorer'
    fraVerdi: Verdi
    tilVerdi: Verdi
    onBekreft: () => void
    onAvbryt: () => void
    lagrer: boolean
}) {
    const { t } = useLanguage()

    if (!apen) return null

    const tekst =
        type === 'vinner'
            ? tx(t.hjem.bekreftByttetTekstVinner, { fra: fraVerdi.label, til: tilVerdi.label })
            : tx(t.hjem.bekreftByttetTekstTopps, { fra: fraVerdi.label, til: tilVerdi.label })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/55 p-6 backdrop-blur-[1px]">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-pop">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                        <TriangleAlert className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                        <h2 className="text-base font-extrabold text-stone-900">{t.hjem.bekreftByttetTittel}</h2>
                        <p className="mt-1 text-sm text-stone-600">{tekst}</p>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-3 rounded-xl bg-stone-50 px-3 py-3 ring-1 ring-stone-200">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-stone-500">
                        {fraVerdi.flagg && <span className="text-lg leading-none">{fraVerdi.flagg}</span>}
                        <span className="truncate">{fraVerdi.label}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-stone-900">
                        {tilVerdi.flagg && <span className="text-lg leading-none">{tilVerdi.flagg}</span>}
                        <span className="truncate">{tilVerdi.label}</span>
                    </span>
                </div>

                <ul className="mt-4 space-y-1.5 text-xs text-stone-600">
                    <li>{t.hjem.bekreftByttetPunkt1}</li>
                    <li>{t.hjem.bekreftByttetPunkt2}</li>
                    <li>{t.hjem.bekreftByttetPunkt3}</li>
                </ul>

                <button type="button" onClick={onBekreft} disabled={lagrer} className="bp-btn-primary mt-4 w-full">
                    {lagrer ? t.felles.lagrer : t.hjem.bekreftByttetKnapp}
                </button>
                <button type="button" onClick={onAvbryt} disabled={lagrer} className="bp-btn-ghost mt-2 w-full">
                    {t.felles.avbryt}
                </button>
            </div>
        </div>
    )
}
