import type { NextPage } from 'next'
import React, { useState } from 'react'
import { Save, X } from 'lucide-react'

import { Spinner } from '../components/loading/Spinner'
import { BpCard } from '../components/Card'
import { SpillerVelger } from '../components/SpillerVelger'
import { UseTournamentResult } from '../queries/useTournamentResult'
import { UseMutateTournamentResult } from '../queries/mutateTournamentResult'
import { UsePlayers } from '../queries/usePlayers'
import { alleLagSortert } from '../utils/lag'
import { Button } from '@/components/ui/button'

// Superadmin registrerer den faktiske turneringsfasiten (vinner-lag +
// toppscorer(e)). Å lagre ER handlingen som gir bonuspoeng — leaderboard
// beregner winnerPoints/topscorerPoints på nytt fra fasiten på neste hent
// (se calculateAllBetsExtended.ts). Ingen poeng lagres eksplisitt.
const VinnerToppscorer: NextPage = () => {
    const { data } = UseTournamentResult()
    const { data: spillere } = UsePlayers()
    const { mutate, isPending } = UseMutateTournamentResult()

    const lagretWinner = data?.winnerTeam ?? ''
    const lagretTopscorere = data?.topscorerPlayerIds ?? []

    const [winnerTeam, setWinnerTeam] = useState(lagretWinner)
    const [topscorerPlayerIds, setTopscorerPlayerIds] = useState<number[]>(lagretTopscorere)
    const [forrigeLagretWinner, setForrigeLagretWinner] = useState(lagretWinner)
    const [forrigeLagretTopscorere, setForrigeLagretTopscorere] = useState<number[]>(lagretTopscorere)
    const [nyligLagret, setNyligLagret] = useState(false)
    const [feil, setFeil] = useState<string | null>(null)

    if (lagretWinner !== forrigeLagretWinner) {
        setForrigeLagretWinner(lagretWinner)
        setWinnerTeam(lagretWinner)
    }
    if (JSON.stringify(lagretTopscorere) !== JSON.stringify(forrigeLagretTopscorere)) {
        setForrigeLagretTopscorere(lagretTopscorere)
        setTopscorerPlayerIds(lagretTopscorere)
    }

    if (!data || !spillere) {
        return <Spinner />
    }

    const erDirty =
        winnerTeam !== lagretWinner || JSON.stringify(topscorerPlayerIds) !== JSON.stringify(lagretTopscorere)

    const lagre = () => {
        setFeil(null)
        mutate(
            { winnerTeam: winnerTeam || null, topscorerPlayerIds },
            {
                onSuccess: () => {
                    setNyligLagret(true)
                    setTimeout(() => setNyligLagret(false), 2500)
                },
                onError: () => setFeil('Kunne ikke lagre — prøv igjen.'),
            },
        )
    }

    const fjernTopscorer = (playerId: number) => {
        setTopscorerPlayerIds((prev) => prev.filter((id) => id !== playerId))
    }

    const leggTilTopscorer = (playerId: number | null) => {
        if (playerId == null) return
        setTopscorerPlayerIds((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]))
    }

    return (
        <div className="space-y-3">
            <div>
                <h1 className="text-2xl font-bold text-stone-900">Vinner og toppscorer</h1>
                <p className="text-sm text-stone-500">
                    Registrer den faktiske turneringsfasiten. Bonuspoeng regnes ut på nytt automatisk når du lagrer.
                </p>
            </div>

            <BpCard>
                <span className="bp-overline">Vinner</span>
                <select
                    value={winnerTeam}
                    onChange={(e) => setWinnerTeam(e.target.value)}
                    aria-label="Sett vinner"
                    className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
                >
                    <option value="">Ikke avgjort</option>
                    {alleLagSortert.map((l) => (
                        <option key={l.tla} value={l.tla}>
                            {l.flagg + ' ' + l.norsk}
                        </option>
                    ))}
                </select>
            </BpCard>

            <BpCard>
                <span className="bp-overline">Toppscorer(e)</span>
                <div className="mt-2 space-y-2">
                    {topscorerPlayerIds.length === 0 ? (
                        <p className="text-sm text-stone-400 italic">Ingen registrert ennå.</p>
                    ) : (
                        topscorerPlayerIds.map((id) => {
                            const spiller = spillere.find((s) => s.id === id)
                            return (
                                <div
                                    key={id}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 ring-1 ring-stone-200"
                                >
                                    <span className="text-sm font-medium text-stone-900">
                                        {spiller ? spiller.name : `Spiller #${id}`}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => fjernTopscorer(id)}
                                        className="text-stone-400 hover:text-red-600"
                                        aria-label="Fjern"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            )
                        })
                    )}
                </div>
                <div className="mt-3">
                    <SpillerVelger
                        valgtId={null}
                        spillere={spillere.filter((s) => !topscorerPlayerIds.includes(s.id))}
                        placeholder="Legg til spiller …"
                        onVelg={leggTilTopscorer}
                    />
                </div>
            </BpCard>

            <div className="flex items-center gap-3">
                <Button onClick={lagre} loading={isPending} disabled={!erDirty} icon={<Save className="w-4 h-4" />}>
                    Lagre
                </Button>
                {!erDirty && nyligLagret && <span className="text-xs font-medium text-emerald-700">Lagret</span>}
                {feil && <span className="text-xs text-red-600">{feil}</span>}
            </div>
        </div>
    )
}

export default VinnerToppscorer
