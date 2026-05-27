import React from 'react'
import { Goal, TriangleAlert, Users, Wallet } from 'lucide-react'
import { InnloggingKnapper } from '../auth/InnloggingKnapper'
import { useLanguage } from '../i18n/LanguageContext'

const PUNKT_IKONER = [
    <Wallet key="wallet" className="h-4 w-4" />,
    <Goal key="goal" className="h-4 w-4" />,
    <Users key="users" className="h-4 w-4" />,
]

export function SignInScreen() {
    const { t } = useLanguage()

    const isFacebookInAppBrowser = typeof navigator !== 'undefined' && /FB_IAB|FBAN|FBAV/.test(navigator.userAgent)

    return (
        <div className="space-y-4">
            <header className="flex flex-col items-center pt-6 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="favicon-512x512.png"
                    alt="VM Betpool"
                    className="h-24 w-24 rounded-2xl shadow-md ring-1 ring-stone-200/70"
                />
                <h1 className="mt-4 text-3xl font-bold text-stone-900">{t.innlogging.tittel}</h1>
                <p className="mt-1 text-stone-500">{t.innlogging.undertittel}</p>
            </header>

            <div className="divide-y divide-stone-100 rounded-xl bg-white shadow-xs ring-1 ring-stone-200/70">
                {t.innlogging.punkter.map((p, i) => (
                    <div key={p.tittel} className="flex items-start gap-3 px-4 py-3.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                            {PUNKT_IKONER[i]}
                        </span>
                        <div className="min-w-0">
                            <p className="font-semibold text-stone-900">{p.tittel}</p>
                            <p className="text-sm leading-relaxed text-stone-500">{p.tekst}</p>
                        </div>
                    </div>
                ))}
            </div>

            {isFacebookInAppBrowser ? (
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3.5 ring-1 ring-amber-200">
                    <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <p className="text-sm leading-relaxed text-amber-900">{t.innlogging.facebookAdvarsel}</p>
                </div>
            ) : (
                <div className="bp-card">
                    <p className="mb-3 text-center text-sm font-medium text-stone-700">{t.innlogging.loggInnKnapp}</p>
                    <InnloggingKnapper />
                    <p className="mt-3 text-center text-xs text-stone-400">{t.innlogging.brukVanligNettleser}</p>
                </div>
            )}
        </div>
    )
}
