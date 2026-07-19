import type { NextPage } from 'next'
import React, { useState } from 'react'
import { Eye, Save, Trophy, X } from 'lucide-react'

import { Spinner } from '../components/loading/Spinner'
import { BpCard } from '../components/Card'
import { SpillerVelger } from '../components/SpillerVelger'
import { UseTournamentResult } from '../queries/useTournamentResult'
import { UseMutateTournamentResult } from '../queries/mutateTournamentResult'
import { UsePlayers } from '../queries/usePlayers'
import { UsePodiumDryRun, UsePodiumPost } from '../queries/mutatePodium'
import { AI_MODELL_VALG, AiModellId } from '../queries/mutateAdminCron'
import { alleLagSortert } from '../utils/lag'
import { Button } from '@/components/ui/button'

// Superadmin trykker denne når resultatene er verifisert: poster pallen
// (topp-3 i hovedligaen + en AI-skrevet oppsummering av reisen deres) i
// feeden. Krever at vinneren er lagret over — det ER verifiseringen.
// Se src/server/feed/podiumAi.ts for kontrakten.
function PodiumVerifisering({ vinnerSatt }: { vinnerSatt: boolean }) {
    const [modell, setModell] = useState<AiModellId>('claude-sonnet-4-6')
    const dryRun = UsePodiumDryRun()
    const post = UsePodiumPost()

    const håndterPost = () => {
        if (!window.confirm('Poste pallen i feeden nå? Dette kan ikke gjøres om.')) return
        post.mutate({ modell })
    }

    const postGrunnTekst: Record<string, string> = {
        allerede_postet: 'Pallen er allerede postet tidligere.',
        fasit_ikke_satt: 'Sett og lagre vinneren over først.',
    }

    return (
        <BpCard>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <span className="bp-overline">Pallen</span>
                    <p className="mt-1 text-sm text-stone-600">
                        Når resultatene er verifisert: post en feed-post som viser pallen (topp 3 i hovedligaen) og lar
                        Claude skrive en oppsummering av reisen deres gjennom turneringen.
                    </p>
                </div>
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
                    Sett og lagre vinneren over først.
                </p>
            )}

            <div className="mt-3 flex gap-2">
                <Button
                    variant="ghost"
                    size="small"
                    loading={dryRun.isPending}
                    icon={<Eye className="h-4 w-4" />}
                    disabled={!vinnerSatt}
                    onClick={() => dryRun.mutate({ modell })}
                >
                    Forhåndsvis
                </Button>
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

            {dryRun.error && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{dryRun.error.message}</p>
            )}
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
                        : (post.data.grunn && postGrunnTekst[post.data.grunn]) || 'Ingen post laget.'}
                </p>
            )}

            {dryRun.isSuccess && dryRun.data && !dryRun.data.rapport && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                    {(dryRun.data.grunn && postGrunnTekst[dryRun.data.grunn]) || 'Ingen forhåndsvisning tilgjengelig.'}
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
                                <div key={s.userId} className="rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200/70">
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
    )
}

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

            <PodiumVerifisering vinnerSatt={!erDirty && lagretWinner !== ''} />
        </div>
    )
}

export default VinnerToppscorer
