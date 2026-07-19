import type { NextPage } from 'next'
import React, { useState } from 'react'
import { Eye } from 'lucide-react'

import { Spinner } from '../components/loading/Spinner'
import { BpCard } from '../components/Card'
import { UseTournamentResult } from '../queries/useTournamentResult'
import { UsePodiumDryRun } from '../queries/mutatePodium'
import { AI_MODELL_VALG, AiModellId } from '../queries/mutateAdminCron'
import { Button } from '@/components/ui/button'

const GRUNN_TEKST: Record<string, string> = {
    fasit_ikke_satt: 'Sett og lagre vinneren på /vinner-toppscorer først.',
}

// Ren forhåndsvisning av pallen: bygger konteksten (topp 3 i hovedligaen +
// fasiten) og lar Claude skrive oppsummeringen, men poster ingenting. Egen
// side (adskilt fra /podium-post) så en superadmin aldri kan trykke feil og
// poste for ekte når hensikten kun var å se hvordan den blir.
const PodiumForhåndsvisning: NextPage = () => {
    const { data } = UseTournamentResult()
    const [modell, setModell] = useState<AiModellId>('claude-sonnet-4-6')
    const dryRun = UsePodiumDryRun()

    if (!data) {
        return <Spinner />
    }

    const vinnerSatt = data.winnerTeam !== ''

    return (
        <div className="space-y-3">
            <div>
                <h1 className="text-2xl font-bold text-stone-900">Forhåndsvis pallen</h1>
                <p className="text-sm text-stone-500">
                    Bygger konteksten (topp 3 i hovedligaen + fasiten) og lar Claude skrive oppsummeringen — uten å
                    poste noe. Bruk denne for å sjekke hvordan pallen blir før du poster den for ekte på /podium-post.
                </p>
            </div>

            <BpCard>
                <div className="flex items-start justify-between gap-3">
                    <span className="bp-overline">Modell</span>
                    <select
                        value={modell}
                        onChange={(e) => setModell(e.target.value as AiModellId)}
                        className="shrink-0 rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-700"
                        aria-label="Modell"
                    >
                        {AI_MODELL_VALG.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.navn}
                            </option>
                        ))}
                    </select>
                </div>

                {!vinnerSatt && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                        Sett og lagre vinneren på /vinner-toppscorer først.
                    </p>
                )}

                <div className="mt-3">
                    <Button
                        variant="outline"
                        size="small"
                        loading={dryRun.isPending}
                        icon={<Eye className="h-4 w-4" />}
                        disabled={!vinnerSatt}
                        onClick={() => dryRun.mutate({ modell })}
                    >
                        Forhåndsvis
                    </Button>
                </div>

                {dryRun.error && (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{dryRun.error.message}</p>
                )}

                {dryRun.isSuccess && dryRun.data && !dryRun.data.rapport && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                        {(dryRun.data.grunn && GRUNN_TEKST[dryRun.data.grunn]) || 'Ingen forhåndsvisning tilgjengelig.'}
                    </p>
                )}

                {dryRun.isSuccess && dryRun.data?.rapport && (
                    <div className="mt-3 space-y-2 rounded-lg bg-blue-50 px-3 py-2">
                        <div>
                            <p className="text-base font-bold text-stone-900">{dryRun.data.rapport.tittel}</p>
                            <p className="text-sm italic text-stone-600">{dryRun.data.rapport.ingress}</p>
                        </div>
                        <div className="space-y-1.5">
                            {dryRun.data.kontekst.topp3.map((s) => {
                                const tekst = dryRun.data!.rapport!.spillere.find((sp) => sp.userId === s.userId)
                                return (
                                    <div
                                        key={s.userId}
                                        className="rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200/70"
                                    >
                                        <p className="text-sm font-semibold text-stone-900">
                                            {tekst?.emoji ?? '🏅'} {s.plass}. plass · {s.navn} — {s.poeng} p
                                        </p>
                                        {tekst && (
                                            <p className="mt-0.5 whitespace-pre-line text-sm text-stone-700">
                                                {tekst.tekst}
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </BpCard>
        </div>
    )
}

export default PodiumForhåndsvisning
