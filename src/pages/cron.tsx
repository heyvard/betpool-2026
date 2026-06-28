import type { NextPage } from 'next'
import { Spinner } from '../components/loading/Spinner'
import React from 'react'
import { UseUser } from '../queries/useUser'
import {
    UseMutateAdminCron,
    UseMutateAdminSync,
    UseDryRunSync,
    UseDryRunSendReminders,
    UseDryRunSendVmStart,
    VmStartDryRunBruker,
    UseDryRunSendEveningReminders,
    DryRunEndring,
    DryRunScoreKamp,
    DryRunBruker,
    EttermiddagsVarselDryRunBruker,
} from '../queries/mutateAdminCron'
import { UseMutateSyncPlayers } from '../queries/mutateSyncPlayers'
import {
    UseMutateFeedBackfill,
    UseMutateMorgenrapport,
    UseAiMorgenrapport,
    AiMorgenrapportSeksjon,
    AiModellId,
    AI_MODELL_VALG,
} from '../queries/mutateAdminCron'
import { Button } from '@/components/ui/button'
import { RefreshCw, Bell, Eye, Trophy, Users, Radio, Sunrise, Sparkles } from 'lucide-react'

function formaterFeltVerdi(felt: string, verdi: string | number | null): string {
    if (verdi === null) return 'null'
    if (felt === 'game_start') {
        try {
            return new Date(verdi as string).toLocaleString('nb-NO', {
                timeZone: 'Europe/Oslo',
                dateStyle: 'short',
                timeStyle: 'short',
            })
        } catch {
            return String(verdi)
        }
    }
    return String(verdi)
}

function DryRunEndringRad({ endring }: { endring: DryRunEndring }) {
    const kamp =
        endring.home_team && endring.away_team
            ? `${endring.home_team} vs ${endring.away_team}`
            : `kamp ${endring.match_num}`

    return (
        <li className="text-blue-800">
            <span className="font-medium">{kamp}</span>
            {endring.ny ? (
                <span className="ml-1 text-blue-500">[ny kamp]</span>
            ) : (
                <>
                    {': '}
                    {endring.felt.map((f, i) => (
                        <span key={f}>
                            {i > 0 && ', '}
                            <span className="font-mono text-[11px]">{f}</span>{' '}
                            <span className="text-stone-400">{formaterFeltVerdi(f, endring.fra[f] ?? null)}</span>
                            {' → '}
                            <span>{formaterFeltVerdi(f, endring.til[f] ?? null)}</span>
                        </span>
                    ))}
                </>
            )}
        </li>
    )
}

function scoreStreng(ft: { home: number | null; away: number | null }): string {
    if (ft.home === null || ft.away === null) return '–'
    return `${ft.home}–${ft.away}`
}

function DryRunScoreKampRad({ kamp }: { kamp: DryRunScoreKamp }) {
    const lagNavn =
        kamp.home_team && kamp.away_team ? `${kamp.home_team} vs ${kamp.away_team}` : `kamp ${kamp.match_num}`

    const apiScore = scoreStreng(kamp.api.fullTime)
    const dbScore =
        kamp.db !== null && kamp.db.synced_home_ft !== null && kamp.db.synced_away_ft !== null
            ? `${kamp.db.synced_home_ft}–${kamp.db.synced_away_ft}`
            : '(ingen)'

    const ekstraInfo: string[] = []
    if (kamp.api.extraTime?.home !== null && kamp.api.extraTime?.away !== null) {
        ekstraInfo.push(`ET: ${kamp.api.extraTime?.home}–${kamp.api.extraTime?.away}`)
    }
    if (kamp.api.penalties?.home !== null && kamp.api.penalties?.away !== null) {
        ekstraInfo.push(`pen: ${kamp.api.penalties?.home}–${kamp.api.penalties?.away}`)
    }
    if (kamp.api.duration && kamp.api.duration !== 'REGULAR') {
        ekstraInfo.push(kamp.api.duration)
    }

    return (
        <li className={`text-xs ${kamp.relevant ? 'text-blue-800' : 'text-stone-400'}`}>
            <span className="font-medium">{lagNavn}</span>
            <span className="ml-1 font-mono text-[11px] text-stone-500">[{kamp.status}]</span>
            {' — '}
            <span className="font-mono">
                API: <span className={kamp.villeBlittOppdatert ? 'font-bold text-blue-700' : ''}>{apiScore}</span>
            </span>
            {kamp.db !== null && <span className="ml-1 text-stone-400 font-mono">DB: {dbScore}</span>}
            {ekstraInfo.length > 0 && <span className="ml-1 text-stone-400">({ekstraInfo.join(', ')})</span>}
            {kamp.villeBlittOppdatert && <span className="ml-1 text-blue-500 font-medium">↑ oppdateres</span>}
        </li>
    )
}

function SyncKnapp() {
    const { mutate, isPending, data, error, isSuccess } = UseMutateAdminSync()
    const {
        mutate: dryMutate,
        isPending: dryPending,
        data: dryData,
        error: dryError,
        isSuccess: drySuccess,
    } = UseDryRunSync()
    const [visJson, setVisJson] = React.useState(false)

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Synk kamper og resultater</p>
                    <p className="text-xs text-stone-500">
                        Én fetch mot football-data.org — oppdaterer kampoppsett (tidspunkt, lag, runde) og live-scores i
                        samme kjøring.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="small"
                        loading={dryPending}
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => dryMutate()}
                    >
                        Dry run
                    </Button>
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        icon={<RefreshCw className="h-4 w-4" />}
                        onClick={() => mutate()}
                    >
                        Kjør
                    </Button>
                </div>
            </div>
            {isSuccess && data && (
                <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    {`hentet: ${data.hentet} · kamper oppdatert: ${data.kamper.oppdatert} · scores oppdatert: ${data.scores.oppdatert}`}
                </p>
            )}
            {error && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
            {drySuccess && dryData && (
                <div className="text-xs bg-blue-50 rounded-lg px-3 py-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-blue-800">Dry run</p>
                        <button
                            className="shrink-0 font-mono text-[10px] text-blue-600 hover:text-blue-800"
                            onClick={() => setVisJson((v) => !v)}
                        >
                            {visJson ? 'Skjul JSON' : 'Vis JSON'}
                        </button>
                    </div>
                    {visJson ? (
                        <pre className="max-h-96 overflow-x-auto rounded bg-white p-2 text-[10px] text-stone-700">
                            {JSON.stringify(dryData, null, 2)}
                        </pre>
                    ) : (
                        <>
                            <div>
                                <p className="font-medium text-blue-700 mb-0.5">
                                    Kampoppsett — {dryData.kamper.hentet} hentet,{' '}
                                    {dryData.kamper.oppdatert === 0
                                        ? 'ingen endringer'
                                        : `${dryData.kamper.oppdatert} ville blitt oppdatert`}
                                </p>
                                {dryData.kamper.endringer && dryData.kamper.endringer.length > 0 && (
                                    <ul className="space-y-0.5 text-blue-700">
                                        {dryData.kamper.endringer.map((e) => (
                                            <DryRunEndringRad key={e.match_num} endring={e} />
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div>
                                <p className="font-medium text-blue-700 mb-0.5">
                                    Scores — {dryData.scores.hentet} fra API ({dryData.scores.relevante} relevante),{' '}
                                    {dryData.scores.oppdatert === 0
                                        ? 'ingen ville blitt oppdatert'
                                        : `${dryData.scores.oppdatert} ville blitt oppdatert`}
                                </p>
                                {dryData.scores.kamper.length > 0 && (
                                    <ul className="space-y-0.5">
                                        {dryData.scores.kamper.map((k) => (
                                            <DryRunScoreKampRad key={k.match_num} kamp={k} />
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
            {dryError && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
        </div>
    )
}

function SendPåminnelserKnapp() {
    const { mutate, isPending, data, error, isSuccess } = UseMutateAdminCron('send-reminders')
    const {
        mutate: dryMutate,
        isPending: dryPending,
        data: dryData,
        error: dryError,
        isSuccess: drySuccess,
    } = UseDryRunSendReminders()

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Send påminnelser</p>
                    <p className="text-xs text-stone-500">
                        Sender push-påminnelser til brukere med utippede kamper i morgen.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="small"
                        loading={dryPending}
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => dryMutate()}
                    >
                        Dry run
                    </Button>
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        icon={<Bell className="h-4 w-4" />}
                        onClick={() => mutate()}
                    >
                        Kjør
                    </Button>
                </div>
            </div>
            {isSuccess && data && (
                <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    {`kamper i morgen: ${data.kamperIMorgen} · varslet: ${data.brukereVarslet}`}
                </p>
            )}
            {error && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
            {drySuccess && dryData && (
                <div className="text-xs bg-blue-50 rounded-lg px-3 py-2 space-y-1.5">
                    <p className="font-medium text-blue-800">
                        Dry run: {dryData.kamperIMorgen.length} kamper i morgen —{' '}
                        {dryData.brukereVilBliVarslet.length === 0
                            ? 'ingen ville blitt varslet'
                            : `${dryData.brukereVilBliVarslet.length} ville blitt varslet`}
                    </p>
                    {dryData.brukereVilBliVarslet.length > 0 && (
                        <ul className="space-y-0.5">
                            {dryData.brukereVilBliVarslet.map((bruker: DryRunBruker) => (
                                <li key={bruker.id} className="text-blue-800">
                                    <span className="font-medium">{bruker.name}</span>
                                    <span className="text-stone-400 ml-1">({bruker.email})</span>
                                    <span className="text-stone-400 ml-1">[{bruker.language}]</span>
                                    {' — '}
                                    {bruker.antallUtippet === 1
                                        ? '1 utippet kamp'
                                        : `${bruker.antallUtippet} utippede kamper`}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {dryError && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
        </div>
    )
}

function SendEttermiddagsVarselKnapp() {
    const { mutate, isPending, data, error, isSuccess } = UseMutateAdminCron('send-evening-reminders')
    const {
        mutate: dryMutate,
        isPending: dryPending,
        data: dryData,
        error: dryError,
        isSuccess: drySuccess,
    } = UseDryRunSendEveningReminders()

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Send kveldspåminnelser</p>
                    <p className="text-xs text-stone-500">
                        Sender push-påminnelser til brukere med utippede kamper i kveld og natt.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="small"
                        loading={dryPending}
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => dryMutate()}
                    >
                        Dry run
                    </Button>
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        icon={<Bell className="h-4 w-4" />}
                        onClick={() => mutate()}
                    >
                        Kjør
                    </Button>
                </div>
            </div>
            {isSuccess && data && (
                <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    {`kamper i kveld/natt: ${data.kamperIKveldOgNatt} · varslet: ${data.brukereVarslet}`}
                </p>
            )}
            {error && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
            {drySuccess && dryData && (
                <div className="text-xs bg-blue-50 rounded-lg px-3 py-2 space-y-1.5">
                    <p className="font-medium text-blue-800">
                        Dry run: {dryData.kamperIKveldOgNatt.length} kamper i kveld/natt —{' '}
                        {dryData.brukereVilBliVarslet.length === 0
                            ? 'ingen ville blitt varslet'
                            : `${dryData.brukereVilBliVarslet.length} ville blitt varslet`}
                    </p>
                    {dryData.brukereVilBliVarslet.length > 0 && (
                        <ul className="space-y-0.5">
                            {dryData.brukereVilBliVarslet.map((bruker: EttermiddagsVarselDryRunBruker) => (
                                <li key={bruker.id} className="text-blue-800">
                                    <span className="font-medium">{bruker.name}</span>
                                    <span className="text-stone-400 ml-1">({bruker.email})</span>
                                    <span className="text-stone-400 ml-1">[{bruker.language}]</span>
                                    {' — '}
                                    {bruker.antallUtippet === 1
                                        ? '1 utippet kamp'
                                        : `${bruker.antallUtippet} utippede kamper`}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {dryError && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
        </div>
    )
}

function SendVmStartKnapp() {
    const { mutate, isPending, data, error, isSuccess } = UseMutateAdminCron('send-vm-start')
    const {
        mutate: dryMutate,
        isPending: dryPending,
        data: dryData,
        error: dryError,
        isSuccess: drySuccess,
    } = UseDryRunSendVmStart()

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Send VM-startvarsel</p>
                    <p className="text-xs text-stone-500">Én gang: varsler alle brukere om at VM starter i dag.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="small"
                        loading={dryPending}
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => dryMutate()}
                    >
                        Dry run
                    </Button>
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        icon={<Trophy className="h-4 w-4" />}
                        onClick={() => mutate()}
                    >
                        Kjør
                    </Button>
                </div>
            </div>
            {isSuccess && data && (
                <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    {`varslet: ${(data as { brukereVarslet: number }).brukereVarslet}`}
                </p>
            )}
            {error && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
            {drySuccess && dryData && (
                <div className="text-xs bg-blue-50 rounded-lg px-3 py-2 space-y-1.5">
                    <p className="font-medium text-blue-800">
                        Dry run:{' '}
                        {dryData.brukereVilBliVarslet.length === 0
                            ? 'ingen ville blitt varslet'
                            : `${dryData.brukereVilBliVarslet.length} ville blitt varslet`}
                    </p>
                    {dryData.brukereVilBliVarslet.length > 0 && (
                        <ul className="space-y-0.5">
                            {dryData.brukereVilBliVarslet.map((bruker: VmStartDryRunBruker) => (
                                <li key={bruker.id} className="text-blue-800">
                                    <span className="font-medium">{bruker.name}</span>
                                    <span className="text-stone-400 ml-1">({bruker.email})</span>
                                    <span className="ml-1 font-mono text-[11px] text-stone-400">
                                        [{bruker.language}]
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {dryError && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
        </div>
    )
}

function SyncSpillereKnapp() {
    const { mutate, isPending, data, error, isSuccess } = UseMutateSyncPlayers()

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Synk spillere</p>
                    <p className="text-xs text-stone-500">
                        Engangsjobb: henter alle truppene fra football-data.org til databasen. Grunnlag for strukturert
                        toppscorer-data.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        icon={<Users className="h-4 w-4" />}
                        onClick={() => mutate()}
                    >
                        Kjør
                    </Button>
                </div>
            </div>
            {isSuccess && data && (
                <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    {`hentet: ${data.hentet} spillere · oppdatert: ${data.oppdatert} · lag: ${data.lag}`}
                </p>
            )}
            {error && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5">Kunne ikke lagre — prøv igjen.</p>
            )}
        </div>
    )
}

function FeedBackfillKnapp() {
    const { mutate, isPending, data, error, isSuccess } = UseMutateFeedBackfill()

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Backfill feed</p>
                    <p className="text-xs text-stone-500">
                        Full backfill: fyller feeden med hele turneringens hendelser — kamp-oppsummeringer og
                        morgenrapporter fra første ferdige kamp til i dag. Historisk korrekte tidspunkter og stillinger.
                        Idempotent — dedup på kamp og dato, så allerede backfilte dager hoppes over.
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        icon={<Radio className="h-4 w-4" />}
                        onClick={() => mutate()}
                    >
                        Kjør
                    </Button>
                </div>
            </div>
            {isSuccess && data && (
                <p className="rounded-lg bg-green-50 px-3 py-1.5 text-xs text-green-700">
                    {data.fraDato
                        ? `${data.fraDato} → ${data.tilDato} (${data.dager} dager) · kamp-poster: ${data.kampposter} · morgenrapporter: ${data.morgenrapporter}`
                        : 'Ingen ferdige kamper å backfille ennå.'}
                </p>
            )}
            {error && (
                <p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">Kunne ikke lagre — prøv igjen.</p>
            )}
        </div>
    )
}

function MorgenrapportKnapp() {
    const { mutate, isPending, data, error, isSuccess } = UseMutateMorgenrapport()

    const grunnTekst: Record<string, string> = {
        allerede_postet: 'Allerede postet i dag — ingen ny rapport laget.',
        stille_dag: 'Stille dag — ingen ferdige kamper i vinduet (24 t), ingen rapport.',
        ingen_baseline: 'Ingen baseline ennå — snapshot lagret, men ingen rapport.',
    }

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Kjør morgenrapport</p>
                    <p className="text-xs text-stone-500">
                        Lager og poster den AI-genererte morgenrapporten (Claude) for i dag manuelt (uten å vente til kl
                        8). Ser 24 timer bakover etter ferdige kamper. Idempotent — lager ikke to rapporter for samme
                        dag.
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        icon={<Sunrise className="h-4 w-4" />}
                        onClick={() => mutate()}
                    >
                        Kjør
                    </Button>
                </div>
            </div>
            {isSuccess && data && (
                <p className="rounded-lg bg-green-50 px-3 py-1.5 text-xs text-green-700">
                    {data.postet
                        ? `Morgenrapport postet · kamper: ${data.antallKamper}` +
                          (data.kostnad ? ` · $${data.kostnad.usd.toFixed(4)}` : '')
                        : (data.grunn && grunnTekst[data.grunn]) || 'Ingen rapport laget.'}
                </p>
            )}
            {error && (
                <p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">Kunne ikke lagre — prøv igjen.</p>
            )}
        </div>
    )
}

// Gårsdagens dato (YYYY-MM-DD) i nettleserens tidssone — default for natt-velgeren.
function iGårISO(): string {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function AiSeksjon({ seksjon }: { seksjon: AiMorgenrapportSeksjon }) {
    return (
        <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200/70">
            <p className="text-sm font-semibold text-stone-900">
                <span className="mr-1.5">{seksjon.emoji}</span>
                {seksjon.overskrift}
            </p>
            <p className="mt-0.5 whitespace-pre-line text-sm text-stone-700">{seksjon.tekst}</p>
        </div>
    )
}

function AiMorgenrapportKnapp() {
    const { mutate, isPending, data, error, isSuccess } = UseAiMorgenrapport()
    const [dato, setDato] = React.useState(iGårISO)
    const [modell, setModell] = React.useState<AiModellId>('claude-sonnet-4-6')
    const [visJson, setVisJson] = React.useState(false)

    const modellNavn = (id: AiModellId) => AI_MODELL_VALG.find((m) => m.id === id)?.navn ?? id

    return (
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">AI-morgenrapport (dry run)</p>
                    <p className="text-xs text-stone-500">
                        Lar Claude (velg Sonnet eller Haiku) skrive en kommentator-oppsummering av natten — kamper,
                        tabell-endringer, beste tips, joker og Norge. Poster ingenting; viser kun rapporten +
                        API-kostnaden for valgt natt og modell.
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <select
                        value={modell}
                        onChange={(e) => setModell(e.target.value as AiModellId)}
                        className="rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-700"
                        aria-label="Modell"
                    >
                        {AI_MODELL_VALG.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.navn}
                            </option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={dato}
                        onChange={(e) => setDato(e.target.value)}
                        className="rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-700"
                        aria-label="Rapportdato (natt)"
                    />
                    <Button
                        variant="outline"
                        size="small"
                        loading={isPending}
                        icon={<Sparkles className="h-4 w-4" />}
                        onClick={() => mutate({ dato, modell })}
                    >
                        Kjør
                    </Button>
                </div>
            </div>
            {error && (
                <p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
                    {error instanceof Error ? error.message : 'Kunne ikke kjøre — prøv igjen.'}
                </p>
            )}
            {isSuccess && data && data.rapport === null && (
                <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                    Ingen ferdige kamper i vinduet for {data.rapportDato} — ingen rapport laget.
                </p>
            )}
            {isSuccess && data && data.rapport && (
                <div className="space-y-2 rounded-lg bg-blue-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-blue-800">
                            {data.rapportDato} · {modellNavn(data.modell)} · {data.antallKamper} kamper
                            {data.kostnad &&
                                ` · $${data.kostnad.usd.toFixed(4)} (${data.kostnad.inputTokens} in / ${data.kostnad.outputTokens} ut)`}
                            {!data.harBaseline && ' · ingen baseline (mangler gårsdagens snapshot)'}
                        </p>
                        <button
                            className="shrink-0 font-mono text-[10px] text-blue-600 hover:text-blue-800"
                            onClick={() => setVisJson((v) => !v)}
                        >
                            {visJson ? 'Skjul JSON' : 'Vis JSON'}
                        </button>
                    </div>
                    {visJson ? (
                        <pre className="max-h-96 overflow-x-auto rounded bg-white p-2 text-[10px] text-stone-700">
                            {JSON.stringify({ rapport: data.rapport, kontekst: data.kontekst }, null, 2)}
                        </pre>
                    ) : (
                        <div className="space-y-2">
                            <div>
                                <p className="text-base font-bold text-stone-900">{data.rapport.tittel}</p>
                                <p className="whitespace-pre-line text-sm italic text-stone-600">
                                    {data.rapport.ingress}
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                {data.rapport.seksjoner.map((s, i) => (
                                    <AiSeksjon key={i} seksjon={s} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

const CronPage: NextPage = () => {
    const { data: me } = UseUser()

    if (!me) return <Spinner />

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-stone-900">Cron-jobber</h1>
            <div className="bp-card">
                <div className="divide-y divide-stone-100">
                    <SyncKnapp />
                    <SyncSpillereKnapp />
                    <FeedBackfillKnapp />
                    <MorgenrapportKnapp />
                    <AiMorgenrapportKnapp />
                    <SendPåminnelserKnapp />
                    <SendEttermiddagsVarselKnapp />
                    <SendVmStartKnapp />
                </div>
            </div>
        </div>
    )
}

export default CronPage
