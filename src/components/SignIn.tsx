import React from 'react'
import { EmailAuthProvider, GoogleAuthProvider } from 'firebase/auth'
import StyledFirebaseAuth from '../auth/StyledFirebaseAuth'
import { Goal, TriangleAlert, Users, Wallet } from 'lucide-react'

const uiConfig = {
    signInSuccessUrl: '/',
    signInFlow: 'popup',
    signInOptions: [GoogleAuthProvider.PROVIDER_ID, EmailAuthProvider.PROVIDER_ID],
}

const punkter = [
    {
        ikon: <Wallet className="h-4 w-4" />,
        tittel: '300 kr i innskudd',
        tekst: 'Vippses før den første kampen starter. Hele potten går til premier.',
    },
    {
        ikon: <Goal className="h-4 w-4" />,
        tittel: 'Tipp alle kampene',
        tekst: 'Tipp resultatet på hver kamp helt frem til avspark — pluss toppscorer og hvem som vinner VM.',
    },
    {
        ikon: <Users className="h-4 w-4" />,
        tittel: 'Åpent for alle med lenken',
        tekst: 'Hvem som helst med denne lenken kan bli med.',
    },
]

export function SignInScreen() {
    const isFacebookInAppBrowser =
        /FB_IAB/.test(navigator.userAgent) || /FBAN/.test(navigator.userAgent) || /FBAV/.test(navigator.userAgent)

    return (
        <div className="space-y-4">
            <header className="flex flex-col items-center pt-6 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="favicon-512x512.png"
                    alt="VM Betpool"
                    className="h-24 w-24 rounded-2xl shadow-md ring-1 ring-stone-200/70"
                />
                <h1 className="mt-4 text-3xl font-bold text-stone-900">VM Betpool</h1>
                <p className="mt-1 text-stone-500">Tippekonkurranse for fotball-VM 2026</p>
            </header>

            <div className="divide-y divide-stone-100 rounded-xl bg-white shadow-xs ring-1 ring-stone-200/70">
                {punkter.map((p) => (
                    <div key={p.tittel} className="flex items-start gap-3 px-4 py-3.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                            {p.ikon}
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
                    <p className="text-sm leading-relaxed text-amber-900">
                        Du er inne via Facebook. For å logge inn må du åpne denne siden i en vanlig nettleser — trykk på
                        menyen og velg «Åpne i nettleser».
                    </p>
                </div>
            ) : (
                <div className="bp-card">
                    <p className="mb-3 text-center text-sm font-medium text-stone-700">Logg inn for å bli med</p>
                    <StyledFirebaseAuth uiConfig={uiConfig} className="fb-auth" />
                    <p className="mt-3 text-center text-xs text-stone-400">Bruk din vanlige nettleser på mobil.</p>
                </div>
            )}
        </div>
    )
}
