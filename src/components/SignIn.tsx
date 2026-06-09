import React, { useEffect, useState } from 'react'
import { Goal, Link2, TriangleAlert, Users, Wallet } from 'lucide-react'
import { InnloggingKnapper } from '../auth/InnloggingKnapper'
import { useLanguage } from '../i18n/LanguageContext'
import { lesPendingInvite } from '../utils/pendingInvite'
import { tx } from '../i18n/interpolate'

const PUNKT_IKONER = [
    <Wallet key="wallet" className="h-4 w-4" />,
    <Goal key="goal" className="h-4 w-4" />,
    <Users key="users" className="h-4 w-4" />,
]

interface PottData {
    betalte: number
    pott: number
}

export function SignInScreen() {
    const { t } = useLanguage()

    // Leses etter mount for å unngå hydration-mismatch.
    const [følgerInvitasjon, setFølgerInvitasjon] = useState(false)
    const [pottData, setPottData] = useState<PottData | null>(null)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFølgerInvitasjon(lesPendingInvite() != null)
        fetch('/api/v1/pott')
            .then((r) => (r.ok ? r.json() : null))
            .then((data: PottData | null) => {
                if (data) setPottData(data)
            })
            .catch(() => undefined)
    }, [])

    const isFacebookInAppBrowser = typeof navigator !== 'undefined' && /FB_IAB|FBAN|FBAV/.test(navigator.userAgent)

    return (
        <div className="space-y-4">
            {følgerInvitasjon && (
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3.5 ring-1 ring-amber-200">
                    <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <p className="text-sm leading-relaxed text-amber-900">{t.innlogging.invitasjonBanner}</p>
                </div>
            )}
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

            {pottData && (
                <div className="rounded-xl bg-white px-4 py-3.5 text-center shadow-xs ring-1 ring-stone-200/70">
                    <p className="bp-overline">{t.innlogging.pottLabel}</p>
                    <p className="text-3xl font-bold text-stone-900">
                        {pottData.pott.toLocaleString('nb-NO')} {t.felles.kr}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                        {tx(t.innlogging.pottDeltakere, { antall: pottData.betalte })}
                    </p>
                    <p className="mt-1 text-xs font-medium text-amber-700">{t.innlogging.pottVokser}</p>
                </div>
            )}

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
                    <InnloggingKnapper />
                </div>
            )}
        </div>
    )
}
