import { useState, useEffect } from 'react'
import {
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
    AuthError,
} from 'firebase/auth'
import { Eye, EyeOff, ChevronLeft } from 'lucide-react'
import { getFirebaseAuth } from './clientApp'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { cn } from '@/lib/utils'

type Modus = 'logginn' | 'registrer'

// På mobile nettlesere (særlig iOS Safari) åpner signInWithPopup Google-innlogging
// i en ny fane. Etter at innloggingen er ferdig lukker ikke Safari fanen / gir ikke
// fokus tilbake pålitelig, så brukeren blir stående på feil fane og må bytte manuelt.
// Firebase anbefaler signInWithRedirect på mobil — da navigerer samme fane til Google
// og tilbake igjen, uten ekstra fane.
function børBrukeRedirect(): boolean {
    if (typeof navigator === 'undefined') return false
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1
}

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
    const [navn, setNavn] = useState('')
    const [feil, setFeil] = useState<string | null>(null)
    const [laster, setLaster] = useState(false)
    const [tilbakestiltSendt, setTilbakestiltSendt] = useState(false)
    const [visPassord, setVisPassord] = useState(false)

    useEffect(() => {
        const conflict = sessionStorage.getItem('betpool_email_conflict')
        if (conflict) {
            sessionStorage.removeItem('betpool_email_conflict')
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFeil('Denne e-postadressen er allerede registrert med en annen innloggingsmetode.')
        }
        // Fang opp feil fra redirect-baserte Google-innlogginger (mobil). Selve
        // sesjonen plukkes opp av onAuthStateChanged; her henter vi bare ut feil.
        getRedirectResult(getFirebaseAuth()).catch((e) => {
            const kode = (e as AuthError).code
            setFeil(oversettFeil(kode, 'google'))
        })
    }, [])

    const loggInnMedGoogle = async () => {
        setFeil(null)
        const provider = new GoogleAuthProvider()
        try {
            if (børBrukeRedirect()) {
                await signInWithRedirect(getFirebaseAuth(), provider)
            } else {
                await signInWithPopup(getFirebaseAuth(), provider)
            }
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
        setVisPassord(false)
        setModus(nyModus)
    }

    const tilbake = () => {
        setFeil(null)
        setTilbakestiltSendt(false)
        setVisPassord(false)
        setModus('logginn')
        setVisEpost(false)
    }

    const åpnEpostSkjema = (nyModus: Modus) => {
        setFeil(null)
        setTilbakestiltSendt(false)
        setVisPassord(false)
        setModus(nyModus)
        setVisEpost(true)
    }

    if (!visEpost) {
        return (
            <div className="space-y-3">
                <p className="text-center text-base font-semibold text-stone-800">Klar til å bli med?</p>
                {feil && <p className="text-center text-sm text-red-600">{feil}</p>}
                <Button variant="outline" className="w-full" onClick={loggInnMedGoogle}>
                    <GoogleLogo />
                    Fortsett med Google
                </Button>
                <div className="flex items-center gap-2">
                    <hr className="flex-1 border-stone-200" />
                    <span className="text-xs text-stone-400">eller</span>
                    <hr className="flex-1 border-stone-200" />
                </div>
                <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => åpnEpostSkjema('registrer')}>
                        Opprett konto
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => åpnEpostSkjema('logginn')}>
                        Logg inn
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <button
                type="button"
                className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
                onClick={tilbake}
            >
                <ChevronLeft className="h-4 w-4" />
                Tilbake
            </button>

            <div className="text-center">
                <h2 className="text-xl font-bold text-stone-900">
                    {modus === 'registrer' ? 'Opprett konto' : 'Logg inn'}
                </h2>
                <p className="text-sm text-stone-500">
                    {modus === 'registrer' ? 'Bli med i VM-konkurransen' : 'Velkommen tilbake'}
                </p>
            </div>

            <div className="flex rounded-lg bg-stone-100 p-1">
                <button
                    type="button"
                    className={cn(
                        'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
                        modus === 'registrer'
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-500 hover:text-stone-700',
                    )}
                    onClick={() => byttModus('registrer')}
                >
                    Ny bruker
                </button>
                <button
                    type="button"
                    className={cn(
                        'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
                        modus === 'logginn'
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-500 hover:text-stone-700',
                    )}
                    onClick={() => byttModus('logginn')}
                >
                    Logg inn
                </button>
            </div>

            {modus === 'logginn' ? (
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
                    <PassordFelt
                        value={passord}
                        onChange={(e) => setPassord(e.target.value)}
                        autoComplete="current-password"
                        visPassord={visPassord}
                        onToggleVis={() => setVisPassord((v) => !v)}
                        error={!!feil}
                    />
                    <div className="flex justify-end">
                        <button
                            type="button"
                            className="text-xs text-stone-400 underline hover:text-stone-600"
                            onClick={sendTilbakestilling}
                        >
                            Glemt passord?
                        </button>
                    </div>
                    {feil && <p className="text-sm text-red-600">{feil}</p>}
                    {tilbakestiltSendt && (
                        <p className="text-sm text-green-700">E-post for tilbakestilling er sendt.</p>
                    )}
                    <Button type="submit" className="w-full" loading={laster}>
                        Logg inn
                    </Button>
                    <p className="text-center text-xs text-stone-400">
                        Ny bruker?{' '}
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
                    <PassordFelt
                        value={passord}
                        onChange={(e) => setPassord(e.target.value)}
                        autoComplete="new-password"
                        visPassord={visPassord}
                        onToggleVis={() => setVisPassord((v) => !v)}
                        error={!!feil}
                    />
                    {feil && <p className="text-sm text-red-600">{feil}</p>}
                    <Button type="submit" className="w-full" loading={laster}>
                        Opprett konto
                    </Button>
                    <p className="text-center text-xs text-stone-400">
                        Har du konto?{' '}
                        <button
                            type="button"
                            className="underline hover:text-stone-600"
                            onClick={() => byttModus('logginn')}
                        >
                            Logg inn
                        </button>
                    </p>
                </form>
            )}
        </div>
    )
}

interface PassordFeltProps {
    value: string
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    autoComplete: string
    visPassord: boolean
    onToggleVis: () => void
    error: boolean
}

function PassordFelt({ value, onChange, autoComplete, visPassord, onToggleVis, error }: PassordFeltProps) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-stone-700">Passord</label>
            <div className="relative">
                <input
                    type={visPassord ? 'text' : 'password'}
                    value={value}
                    onChange={onChange}
                    autoComplete={autoComplete}
                    required
                    className={cn(
                        'h-9 w-full rounded-lg border bg-white px-3 py-1.5 pr-10 text-sm outline-hidden transition-shadow',
                        'focus:border-amber-500 focus:ring-2 focus:ring-amber-400',
                        error ? 'border-red-500 ring-1 ring-red-400' : 'border-stone-300',
                    )}
                />
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label={visPassord ? 'Skjul passord' : 'Vis passord'}
                    onClick={onToggleVis}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                    {visPassord ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </div>
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
