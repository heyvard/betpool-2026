import type { NextPage } from 'next'
import React from 'react'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Spinner } from '../components/loading/Spinner'
import { UseUser } from '../queries/useUser'
import { useAuthedFetch } from '../auth/authedFetch'

// Superadmin-debugside: henter rå JSON fra de viktigste API-ene (bets, matches,
// users, feed+leaderboard) og viser hver respons, med en knapp for å laste ned alt
// samlet i én navngitt JSON-fil som senere kan lastes inn som kontekst for debugging.

interface Seksjon {
    nøkkel: string
    tittel: string
    kilde: string
    data: unknown
}

const DebugData: NextPage = () => {
    const { data: me } = UseUser()
    const authedFetch = useAuthedFetch()
    const [kopiert, setKopiert] = React.useState<string | null>(null)
    const [kopierFeil, setKopierFeil] = React.useState<string | null>(null)

    const {
        data: seksjoner,
        isFetching,
        error,
        refetch,
    } = useQuery({
        queryKey: ['debug-data'],
        enabled: !!me?.superadmin,
        queryFn: async (): Promise<Seksjon[]> => {
            async function hentJson(path: string): Promise<unknown> {
                const res = await authedFetch(path, { method: 'GET' })
                if (!res.ok) throw new Error(`${path} → ${res.status}`)
                return res.json()
            }

            const [bets, matches, users, feedExport] = await Promise.all([
                hentJson('/api/v1/bets'),
                hentJson('/api/v1/matches'),
                hentJson('/api/v1/users'),
                hentJson('/api/v1/admin/feed-export') as Promise<{
                    posts: unknown
                    metadata: { leaderboard: unknown }
                }>,
            ])

            return [
                { nøkkel: 'bets', tittel: 'Bets', kilde: 'GET /api/v1/bets', data: bets },
                { nøkkel: 'matches', tittel: 'Kamper', kilde: 'GET /api/v1/matches', data: matches },
                { nøkkel: 'users', tittel: 'Brukere', kilde: 'GET /api/v1/users', data: users },
                {
                    nøkkel: 'feed',
                    tittel: 'Feed',
                    kilde: 'GET /api/v1/admin/feed-export',
                    data: { posts: feedExport.posts },
                },
                {
                    nøkkel: 'leaderboard',
                    tittel: 'Leaderboard',
                    kilde: 'GET /api/v1/admin/feed-export (metadata.leaderboard)',
                    data: feedExport.metadata.leaderboard,
                },
            ]
        },
    })

    // Bygger fila klientside fra dataene siden allerede har hentet — samme form
    // enten det er én seksjon eller alle, slik at den lastes inn likt som kontekst.
    function byggBundle(valgte: Seksjon[]): string {
        const bundle = {
            _meta: {
                beskrivelse:
                    "Betpool debug-eksport. Hver nøkkel under 'seksjoner' er en separat API-respons (eller server-side-beregning). Last inn som kontekst for debugging.",
                eksportertAt: new Date().toISOString(),
            },
            seksjoner: Object.fromEntries(valgte.map((s) => [s.nøkkel, { kilde: s.kilde, data: s.data }])),
        }
        return JSON.stringify(bundle, null, 2)
    }

    function lastNed(navn: string, valgte: Seksjon[]) {
        const blob = new Blob([byggBundle(valgte)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const stempel = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
        const a = document.createElement('a')
        a.href = url
        a.download = `betpool-debug-${navn}-${stempel}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    }

    async function kopier(nøkkel: string, tekst: string) {
        try {
            await navigator.clipboard.writeText(tekst)
            setKopiert(nøkkel)
            setTimeout(() => setKopiert((k) => (k === nøkkel ? null : k)), 2000)
        } catch {
            setKopierFeil('Kunne ikke kopiere til utklippstavlen.')
        }
    }

    if (!me) return <Spinner />
    if (!me.superadmin) {
        return <p className="text-sm text-stone-600">Kun for superadmin.</p>
    }

    const feil = kopierFeil ?? (error ? String(error) : null)

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-bold text-stone-900">Debug-data</h1>
                <div className="flex gap-2">
                    <Button variant="outline" size="small" loading={isFetching} onClick={() => refetch()}>
                        Hent på nytt
                    </Button>
                    <Button
                        variant="default"
                        size="small"
                        disabled={!seksjoner}
                        onClick={() => lastNed('alt', seksjoner ?? [])}
                    >
                        Last ned alt (JSON)
                    </Button>
                </div>
            </div>

            <p className="text-sm text-stone-600">
                Rå JSON fra de viktigste API-ene. «Last ned alt» samler alle seksjonene i én navngitt fil (hver del
                merket med hvilken response den er) som kan lastes inn som kontekst for debugging.
            </p>

            {feil && <p className="text-sm text-red-600">{feil}</p>}

            {isFetching && !seksjoner ? (
                <Spinner />
            ) : (
                <div className="space-y-3">
                    {(seksjoner ?? []).map((s) => {
                        const tekst = JSON.stringify(s.data, null, 2)
                        return (
                            <details key={s.nøkkel} className="bp-card">
                                <summary className="flex cursor-pointer items-center justify-between gap-2">
                                    <span>
                                        <span className="font-semibold text-stone-900">{s.tittel}</span>{' '}
                                        <span className="text-xs text-stone-500">{s.kilde}</span>
                                    </span>
                                    <span className="flex shrink-0 gap-1">
                                        <Button
                                            variant="ghost"
                                            size="small"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                kopier(s.nøkkel, tekst)
                                            }}
                                        >
                                            {kopiert === s.nøkkel ? 'Kopiert' : 'Kopier'}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="small"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                lastNed(s.nøkkel, [s])
                                            }}
                                        >
                                            Last ned
                                        </Button>
                                    </span>
                                </summary>
                                <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-stone-50 p-3 text-xs text-stone-800">
                                    {tekst}
                                </pre>
                            </details>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default DebugData
