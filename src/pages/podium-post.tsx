import type { NextPage } from 'next'
import React, { useState } from 'react'
import { Trophy } from 'lucide-react'

import { Spinner } from '../components/loading/Spinner'
import { BpCard } from '../components/Card'
import { UseTournamentResult } from '../queries/useTournamentResult'
import { UsePodiumPost } from '../queries/mutatePodium'
import { AI_MODELL_VALG, AiModellId } from '../queries/mutateAdminCron'
import { Button } from '@/components/ui/button'

const GRUNN_TEKST: Record<string, string> = {
    allerede_postet: 'Pallen er allerede postet tidligere.',
    fasit_ikke_satt: 'Sett og lagre vinneren på /vinner-toppscorer først.',
}

// Den faktiske postingen av pallen — egen side (adskilt fra
// /podium-forhandsvisning) slik at superadmin aldri kan trykke feil og poste
// for ekte når hensikten kun var å forhåndsvise. Idempotent: kun én post
// noensinne, og krever at vinneren er lagret på /vinner-toppscorer først.
const PodiumPost: NextPage = () => {
    const { data } = UseTournamentResult()
    const [modell, setModell] = useState<AiModellId>('claude-sonnet-4-6')
    const post = UsePodiumPost()

    if (!data) {
        return <Spinner />
    }

    const vinnerSatt = data.winnerTeam !== ''

    const håndterPost = () => {
        if (!window.confirm('Poste pallen i feeden nå? Dette kan ikke gjøres om.')) return
        post.mutate({ modell })
    }

    return (
        <div className="space-y-3">
            <div>
                <h1 className="text-2xl font-bold text-stone-900">Post pallen</h1>
                <p className="text-sm text-stone-500">
                    Poster pallen (topp 3 i hovedligaen + en AI-skrevet oppsummering av reisen deres) i feeden — synlig
                    for alle. Sjekk gjerne /podium-forhandsvisning først.
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
                        loading={post.isPending}
                        icon={<Trophy className="h-4 w-4" />}
                        disabled={!vinnerSatt}
                        onClick={håndterPost}
                    >
                        Post pallen i feeden
                    </Button>
                </div>

                {post.error && (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{post.error.message}</p>
                )}
                {post.isSuccess && post.data && (
                    <p
                        className={`mt-2 rounded-lg px-3 py-1.5 text-xs ${
                            post.data.postet ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                        }`}
                    >
                        {post.data.postet
                            ? 'Pallen er postet i feeden! 🏆'
                            : (post.data.grunn && GRUNN_TEKST[post.data.grunn]) || 'Ingen post laget.'}
                    </p>
                )}
            </BpCard>
        </div>
    )
}

export default PodiumPost
