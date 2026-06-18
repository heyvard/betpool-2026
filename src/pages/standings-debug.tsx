import type { NextPage } from 'next'
import React from 'react'

import { Button } from '@/components/ui/button'
import { Spinner } from '../components/loading/Spinner'
import { UseUser } from '../queries/useUser'
import { useAuthedFetch } from '../auth/authedFetch'

// Superadmin-debugside: kaller /api/v1/admin/standings-raw og dumper rå-JSON fra
// football-data.org i en <pre>, så responsen kan kopieres og inspiseres.
const StandingsDebug: NextPage = () => {
    const { data: me } = UseUser()
    const authedFetch = useAuthedFetch()
    const [json, setJson] = React.useState<string | null>(null)
    const [laster, setLaster] = React.useState(false)
    const [feil, setFeil] = React.useState<string | null>(null)
    const [kopiert, setKopiert] = React.useState(false)

    if (!me) return <Spinner />
    if (!me.superadmin) {
        return <p className="text-sm text-stone-600">Kun for superadmin.</p>
    }

    async function hent() {
        setLaster(true)
        setFeil(null)
        setKopiert(false)
        try {
            const res = await authedFetch('/api/v1/admin/standings-raw', { method: 'GET' })
            const data = await res.json()
            setJson(JSON.stringify(data, null, 2))
        } catch (e) {
            setFeil(String(e))
        } finally {
            setLaster(false)
        }
    }

    async function kopier() {
        if (!json) return
        try {
            await navigator.clipboard.writeText(json)
            setKopiert(true)
            setTimeout(() => setKopiert(false), 2000)
        } catch {
            setFeil('Kunne ikke kopiere til utklippstavlen.')
        }
    }

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-stone-900">Standings-debug</h1>
            <div className="bp-card space-y-3">
                <p className="text-sm text-stone-600">
                    Henter gruppetabellene rett fra football-data.org og viser rå-responsen (med status og en
                    struktur-oppsummering) for et par URL-varianter.
                </p>
                <div className="flex gap-2">
                    <Button variant="outline" size="small" loading={laster} onClick={hent}>
                        Hent
                    </Button>
                    {json && (
                        <Button variant="ghost" size="small" onClick={kopier}>
                            {kopiert ? 'Kopiert!' : 'Kopier JSON'}
                        </Button>
                    )}
                </div>
                {feil && <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">{feil}</p>}
                {json && (
                    <pre className="max-h-[70vh] overflow-auto rounded-lg bg-stone-900 p-3 text-[11px] leading-relaxed text-stone-100">
                        {json}
                    </pre>
                )}
            </div>
        </div>
    )
}

export default StandingsDebug
