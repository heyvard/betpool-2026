import React, { useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'

import { useAuthedFetch } from '../auth/authedFetch'
import { abonner, hentAbonnement, pushStøttes } from '../utils/push'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

type PushStatus = 'laster' | 'ikkeStøttet' | 'nektet' | 'av' | 'på'

function usePushVarsler() {
    const authedFetch = useAuthedFetch()
    const [status, setStatus] = useState<PushStatus>('laster')
    const [jobber, setJobber] = useState(false)
    const [feil, setFeil] = useState<string | null>(null)
    const [testSendt, setTestSendt] = useState(false)

    useEffect(() => {
        const sjekk = async () => {
            if (!pushStøttes()) {
                setStatus('ikkeStøttet')
                return
            }
            if (Notification.permission === 'denied') {
                setStatus('nektet')
                return
            }
            try {
                const abonnement = await hentAbonnement()
                setStatus(abonnement ? 'på' : 'av')
            } catch {
                setStatus('av')
            }
        }
        sjekk()
    }, [])

    const slåPå = async () => {
        setJobber(true)
        setFeil(null)
        try {
            const abonnement = await abonner()
            const res = await authedFetch('/api/v1/me/push-subscription', {
                method: 'PUT',
                body: JSON.stringify(abonnement),
            })
            if (!res.ok) {
                throw new Error('Kunne ikke lagre abonnementet')
            }
            setStatus('på')
        } catch (e) {
            if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
                setStatus('nektet')
            }
            setFeil(e instanceof Error ? e.message : 'Noe gikk galt')
        } finally {
            setJobber(false)
        }
    }

    const slåAv = async () => {
        setJobber(true)
        setFeil(null)
        try {
            const abonnement = await hentAbonnement()
            if (abonnement) {
                await authedFetch('/api/v1/me/push-subscription', {
                    method: 'DELETE',
                    body: JSON.stringify({ endpoint: abonnement.endpoint }),
                })
                await abonnement.unsubscribe()
            }
            setStatus('av')
        } catch (e) {
            setFeil(e instanceof Error ? e.message : 'Noe gikk galt')
        } finally {
            setJobber(false)
        }
    }

    const sendTest = async () => {
        setJobber(true)
        setFeil(null)
        setTestSendt(false)
        try {
            const res = await authedFetch('/api/v1/me/push-test', { method: 'POST' })
            if (!res.ok) {
                throw new Error('Kunne ikke sende testvarsel')
            }
            setTestSendt(true)
            setTimeout(() => setTestSendt(false), 4000)
        } catch (e) {
            setFeil(e instanceof Error ? e.message : 'Noe gikk galt')
        } finally {
            setJobber(false)
        }
    }

    return { status, jobber, feil, testSendt, slåPå, slåAv, sendTest }
}

export function PushVarsler() {
    const { status, jobber, feil, testSendt, slåPå, slåAv, sendTest } = usePushVarsler()

    if (status === 'laster') {
        return null
    }

    return (
        <div className="my-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <Bell className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <p className="font-semibold text-stone-900">Påminnelser</p>
                        <p className="text-sm text-stone-600">Få et varsel når du har utipsa kamper.</p>
                    </div>
                </div>
                {(status === 'av' || status === 'på') && (
                    <Switch
                        checked={status === 'på'}
                        onCheckedChange={(v) => (v ? slåPå() : slåAv())}
                        loading={jobber}
                        disabled={jobber}
                        aria-label="Skru påminnelser av eller på"
                    />
                )}
            </div>

            {status === 'ikkeStøttet' && (
                <p className="mt-3 text-xs text-stone-500">
                    Nettleseren din støtter ikke varsler. På iPhone må du først legge appen til på hjemskjermen
                    (del-knappen → «Legg til på Hjem-skjerm») og åpne den derfra.
                </p>
            )}
            {status === 'nektet' && (
                <p className="mt-3 text-xs text-stone-500">
                    Varsler er blokkert. Skru dem på igjen i nettleser- eller systeminnstillingene for å få påminnelser.
                </p>
            )}
            {status === 'på' && (
                <div className="mt-3 flex items-center gap-3">
                    <Button size="small" variant="outline" onClick={() => sendTest()} loading={jobber}>
                        Send testvarsel
                    </Button>
                    {testSendt && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <Check className="h-3.5 w-3.5" /> Sendt
                        </span>
                    )}
                </div>
            )}
            {feil && <p className="mt-2 text-xs text-red-600">{feil}</p>}
        </div>
    )
}
