import { useState, useEffect } from 'react'
import {
    signInWithPopup,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
    AuthError,
} from 'firebase/auth'
import { getFirebaseAuth } from './clientApp'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'

type Modus = 'logginn' | 'registrer'

function oversettFeil(kode: string, metode: 'google' | 'epost' = 'epost'): string {
    switch (kode) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
            return 'Feil e-post eller passord.'
        case 'auth/invalid-email':
            return 'Ugyldig e-postadresse.'
        case 'auth/weak-password':
            return 'Passordet må være minst 6 tegn.'
        case 'auth/too-many-requests':
            return 'For mange forsøk — prøv igjen senere.'
        case 'auth/popup-blocked':
            return 'Popup-vinduet ble blokkert. Tillat popups for denne siden.'
        case 'auth/account-exists-with-different-credential':
        case 'auth/email-already-in-use':
            return metode === 'google'
                ? 'Denne e-postadressen er allerede registrert med e-post og passord. Logg inn med e-post i stedet.'
                : 'Denne e-postadressen er allerede registrert. Logg inn i stedet.'
        default:
            return 'Kunne ikke lagre — prøv igjen.'
    }
}

export function InnloggingKnapper() {
    const [visEpost, setVisEpost] = useState(false)
    const [modus, setModus] = useState<Modus>('logginn')
    const [epost, setEpost] = useState('')
    const [passord, setPassord] = useState('')
    const [bekreftPassord, setBekreftPassord] = useState('')
    const [navn, setNavn] = useState('')
    const [feil, setFeil] = useState<string | null>(null)
    const [laster, setLaster] = useState(false)
    const [tilbakestiltSendt, setTilbakestiltSendt] = useState(false)

    useEffect(() => {
        const conflict = sessionStorage.getItem('betpool_email_conflict')
        if (conflict) {
            sessionStorage.removeItem('betpool_email_conflict')
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFeil('Denne e-postadressen er allerede registrert med en annen innloggingsmetode.')
        }
    }, [])

    const loggInnMedGoogle = async () => {
        setFeil(null)
        try {
            await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
        } catch (e) {
            const kode = (e as AuthError).code
            if (kode !== 'auth/popup-closed-by-user' && kode !== 'auth/cancelled-popup-request') {
                setFeil(oversettFeil(kode, 'google'))
            }
        }
    }

    const loggInnMedEpost = async (e: React.FormEvent) => {
        e.preventDefault()
        setFeil(null)
        setLaster(true)
        try {
            await signInWithEmailAndPassword(getFirebaseAuth(), epost, passord)
        } catch (err) {
            setFeil(oversettFeil((err as AuthError).code, 'epost'))
        } finally {
            setLaster(false)
        }
    }

    const registrerMedEpost = async (e: React.FormEvent) => {
        e.preventDefault()
        setFeil(null)
        if (!navn.trim()) {
            setFeil('Fyll inn navnet ditt.')
            return
        }
        if (passord !== bekreftPassord) {
            setFeil('Passordene er ikke like.')
            return
        }
        setLaster(true)
        try {
            const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), epost, passord)
            await updateProfile(credential.user, { displayName: navn.trim() })
        } catch (err) {
            setFeil(oversettFeil((err as AuthError).code, 'epost'))
        } finally {
            setLaster(false)
        }
    }

    const sendTilbakestilling = async () => {
        if (!epost) {
            setFeil('Fyll inn e-postadressen din for å tilbakestille passordet.')
            return
        }
        setFeil(null)
        try {
            await sendPasswordResetEmail(getFirebaseAuth(), epost)
            setTilbakestiltSendt(true)
        } catch (err) {
            setFeil(oversettFeil((err as AuthError).code))
        }
    }

    const byttModus = (nyModus: Modus) => {
        setFeil(null)
        setTilbakestiltSendt(false)
        setModus(nyModus)
    }

    const tilbake = () => {
        setFeil(null)
        setTilbakestiltSendt(false)
        setModus('logginn')
        setVisEpost(false)
    }

    return (
        <div className="space-y-3">
            <Button variant="outline" className="w-full" onClick={loggInnMedGoogle}>
                <GoogleLogo />
                Logg inn med Google
            </Button>

            {!visEpost ? (
                <>
                    {feil && <p className="text-center text-sm text-red-600">{feil}</p>}
                    <button
                        type="button"
                        className="w-full text-center text-sm text-stone-500 underline hover:text-stone-700"
                        onClick={() => {
                            setFeil(null)
                            setVisEpost(true)
                        }}
                    >
                        Logg inn med e-post
                    </button>
                </>
            ) : modus === 'logginn' ? (
                <form onSubmit={loggInnMedEpost} className="space-y-3 pt-1">
                    <TextField
                        label="E-post"
                        type="email"
                        value={epost}
                        onChange={(e) => setEpost(e.target.value)}
                        autoComplete="email"
                        required
                        error={!!feil}
                    />
                    <TextField
                        label="Passord"
                        type="password"
                        value={passord}
                        onChange={(e) => setPassord(e.target.value)}
                        autoComplete="current-password"
                        required
                        error={!!feil}
                    />
                    {feil && <p className="text-sm text-red-600">{feil}</p>}
                    {tilbakestiltSendt && (
                        <p className="text-sm text-green-700">E-post for tilbakestilling er sendt.</p>
                    )}
                    <Button type="submit" className="w-full" loading={laster}>
                        Logg inn
                    </Button>
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            className="text-xs text-stone-400 underline hover:text-stone-600"
                            onClick={sendTilbakestilling}
                        >
                            Glemt passord?
                        </button>
                        <button
                            type="button"
                            className="text-xs text-stone-400 underline hover:text-stone-600"
                            onClick={tilbake}
                        >
                            Tilbake
                        </button>
                    </div>
                    <p className="text-center text-xs text-stone-400">
                        Ikke registrert?{' '}
                        <button
                            type="button"
                            className="underline hover:text-stone-600"
                            onClick={() => byttModus('registrer')}
                        >
                            Opprett konto
                        </button>
                    </p>
                </form>
            ) : (
                <form onSubmit={registrerMedEpost} className="space-y-3 pt-1">
                    <TextField
                        label="Navn"
                        type="text"
                        value={navn}
                        onChange={(e) => setNavn(e.target.value)}
                        autoComplete="name"
                        required
                        error={!!feil}
                    />
                    <TextField
                        label="E-post"
                        type="email"
                        value={epost}
                        onChange={(e) => setEpost(e.target.value)}
                        autoComplete="email"
                        required
                        error={!!feil}
                    />
                    <TextField
                        label="Passord"
                        type="password"
                        value={passord}
                        onChange={(e) => setPassord(e.target.value)}
                        autoComplete="new-password"
                        required
                        error={!!feil}
                    />
                    <TextField
                        label="Bekreft passord"
                        type="password"
                        value={bekreftPassord}
                        onChange={(e) => setBekreftPassord(e.target.value)}
                        autoComplete="new-password"
                        required
                        error={!!feil}
                    />
                    {feil && <p className="text-sm text-red-600">{feil}</p>}
                    <Button type="submit" className="w-full" loading={laster}>
                        Opprett konto
                    </Button>
                    <p className="text-center text-xs text-stone-400">
                        Har du allerede konto?{' '}
                        <button
                            type="button"
                            className="underline hover:text-stone-600"
                            onClick={() => byttModus('logginn')}
                        >
                            Logg inn
                        </button>
                    </p>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            className="text-xs text-stone-400 underline hover:text-stone-600"
                            onClick={tilbake}
                        >
                            Tilbake
                        </button>
                    </div>
                </form>
            )}
        </div>
    )
}

function GoogleLogo() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
                fill="#4285F4"
                d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
            />
            <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
            />
            <path
                fill="#FBBC05"
                d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
            />
            <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z"
            />
        </svg>
    )
}
