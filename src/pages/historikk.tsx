import type { NextPage } from 'next'
import { useEffect, useMemo, useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/router'
import { ArrowLeft, ArrowUp, Search } from 'lucide-react'

import { Spinner } from '../components/loading/Spinner'
import { UseAllBets, AllBets } from '../queries/useAllBets'
import { UseMatches } from '../queries/useMatches'
import { UseUser } from '../queries/useUser'
import { UseLeagues } from '../queries/useLeagues'
import { UseLeague } from '../queries/useLeague'
import { calculateLeaderboard, LeaderBoard } from '../components/results/calculateAllScores'
import { calculateAllBetsExtended, filtrerAllBets } from '../components/results/calculateAllBetsExtended'
import { erKampFerdig } from '../data/matches'
import { useValgtLiga } from '../utils/useValgtLiga'
import { useLanguage } from '../i18n/LanguageContext'
import { tx } from '../i18n/interpolate'
import { cn } from '@/lib/utils'
import { avatarFarge, byggHistorikk, HistorikkDeltaker, HistorikkSerie, velgTegnedeSerier } from '../lib/byggHistorikk'
import { BumpChart } from '../components/historikk/BumpChart'

function visningsnavn(navn: string): string {
    return navn.includes('@') ? navn.split('@')[0] : navn
}

function Avatar({ src, name, farge, size = 34 }: { src?: string | null; name: string; farge: string; size?: number }) {
    return (
        <div className="shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={name} className="h-full w-full object-cover" />
            ) : (
                <span
                    className="flex h-full w-full items-center justify-center font-bold text-white"
                    style={{ background: farge, fontSize: size * 0.42 }}
                >
                    {name ? name.charAt(0).toUpperCase() : ''}
                </span>
            )}
        </div>
    )
}

const Historikk: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { data: matches } = UseMatches()
    const { data: me } = UseUser()
    const { data: ligaer } = UseLeagues()
    const [valgtLiga, setValgtLiga] = useValgtLiga()
    const router = useRouter()
    const { t } = useLanguage()

    // Åpne på samme liga som tavla viste — query-paramet vinner over lagret valg.
    useEffect(() => {
        const fraQuery = router.query.liga
        if (typeof fraQuery === 'string' && fraQuery !== valgtLiga) {
            setValgtLiga(fraQuery)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.query.liga])

    const mineLigaer = (ligaer ?? []).filter((l) => l.my_status === 'medlem')
    const effektivLiga = valgtLiga && mineLigaer.some((l) => l.id === valgtLiga) ? valgtLiga : null
    const { data: ligaDetalj } = UseLeague(effektivLiga)

    const valgtLigaSummary = mineLigaer.find((l) => l.id === effektivLiga)
    const liganavn = effektivLiga && valgtLigaSummary ? valgtLigaSummary.name : t.ledertavle.hovedligaen

    const historikk = useMemo(() => {
        if (!data || !matches) return null
        const raw = data.raw
        const hovedligaIds = new Set(raw.users.filter((u) => u.i_hovedliga !== false).map((u) => u.id))

        let populasjon: Set<string>
        let deltakere: HistorikkDeltaker[]
        let pictures = new Map<string, string | null>()

        if (effektivLiga && ligaDetalj) {
            populasjon = new Set(hovedligaIds)
            ligaDetalj.members.forEach((m) => populasjon.add(m.user_id))
            deltakere = ligaDetalj.members
                .filter((m) => m.status === 'medlem')
                .map((m) => ({ userid: m.user_id, navn: m.name }))
            ligaDetalj.members.forEach((m) => pictures.set(m.user_id, m.picture))
        } else {
            populasjon = new Set(hovedligaIds)
            deltakere = raw.users.filter((u) => u.i_hovedliga !== false).map((u) => ({ userid: u.id, navn: u.name }))
            raw.users.forEach((u) => pictures.set(u.id, u.picture))
        }

        const populasjonsBets = filtrerAllBets(raw, populasjon)

        const beregnTavle = (bets: AllBets): LeaderBoard[] => {
            const ext = calculateAllBetsExtended(bets)
            return calculateLeaderboard(ext.bets, ext.users)
        }

        const h = byggHistorikk(
            populasjonsBets,
            matches,
            deltakere,
            beregnTavle,
            {
                harResultat: (k) => erKampFerdig(k.status),
                kickoff: (k) => new Date(k.game_start).getTime(),
                poengAv: (r) => r.poeng - (r.livePoeng ?? 0),
                visningsnavn,
                farge: avatarFarge,
            },
            { idag: t.historikk.idag, kampdag: t.historikk.kampdag },
        )
        return { ...h, pictures }
    }, [data, matches, ligaDetalj, effektivLiga, t.historikk.idag, t.historikk.kampdag])

    // Brukerens eksplisitte valg. Default-markeringen utledes (uten effekt)
    // når dette er null, så vi unngår en setState-i-effekt-runde.
    const [valgtId, setValgtId] = useState<string | null>(null)
    const [sok, setSok] = useState('')

    if (!data || isLoading || !ligaer || !matches) {
        return <Spinner />
    }
    if (effektivLiga && !ligaDetalj) {
        return <Spinner />
    }
    if (!historikk) {
        return <Spinner />
    }

    const Header = (
        <div className="bg-white px-[18px] pb-[12px] pt-[18px]" style={{ borderBottom: '1px solid #e7e5e4' }}>
            <NextLink
                href="/leaderboard"
                className="mb-[10px] inline-flex items-center gap-1 text-[12.5px] font-bold text-stone-500"
                style={{ minHeight: 28 }}
            >
                <ArrowLeft size={15} /> {t.nav.resultater}
            </NextLink>
            <p className="text-[20px] font-extrabold leading-none tracking-[-0.01em] text-stone-900">
                {t.historikk.tittel}
            </p>
            <p className="mt-[6px] text-[11.5px] leading-none text-stone-400">
                {liganavn} · {t.historikk.plasseringsgraf}
            </p>
        </div>
    )

    const { kampdager, serier } = historikk

    if (kampdager.length === 0) {
        return (
            <div className="-mx-2 min-h-screen bg-stone-50">
                {Header}
                <div className="px-[18px] py-[60px] text-center">
                    <p className="text-[14px] font-semibold text-stone-500">{t.historikk.tomIngenKamper}</p>
                </div>
            </div>
        )
    }

    const sisteIdx = kampdager.length - 1

    // Default markert: innlogget bruker hvis hen er med, ellers lederen på siste kampdag.
    const defaultId =
        me && serier.some((s) => s.userid === me.id)
            ? me.id
            : ([...serier].sort((a, b) => a.ranks[sisteIdx] - b.ranks[sisteIdx])[0]?.userid ?? null)
    const selectedId = valgtId && serier.some((s) => s.userid === valgtId) ? valgtId : defaultId

    const tegnede = velgTegnedeSerier(serier, selectedId, me?.id ?? null)
    const markert: HistorikkSerie | undefined = serier.find((s) => s.userid === selectedId) ?? tegnede[0] ?? serier[0]

    const maxRank = Math.max(1, ...tegnede.flatMap((s) => s.ranks))

    // Søk over alle deltakere (for store ligaer); chips viser de tegnede + treff.
    const sokTreff = sok.trim() ? serier.filter((s) => s.navn.toLowerCase().includes(sok.trim().toLowerCase())) : []
    const erStorLiga = serier.length > tegnede.length

    const klatret = markert ? markert.ranks[0] - markert.ranks[sisteIdx] : 0
    const pilleTekst =
        klatret > 0
            ? tx(t.historikk.klatret, { n: klatret })
            : klatret < 0
              ? tx(t.historikk.falt, { n: -klatret })
              : t.historikk.uendret
    const pilleStil =
        klatret > 0
            ? { color: '#15803d', background: '#dcfce7' }
            : klatret < 0
              ? { color: '#dc2626', background: '#fee2e2' }
              : { color: '#a8a29e', background: '#f5f5f4' }

    const folgDeler = t.historikk.folg.split('{{navn}}')

    // Chips: ved søk vises treffene, ellers de tegnede seriene (topp + meg).
    const chipSerier = sok.trim() ? sokTreff : tegnede

    return (
        <div className="-mx-2 min-h-screen bg-stone-50">
            {Header}

            {/* Graf-blokk */}
            <div className="px-[14px] pt-[14px]">
                <div
                    className="bg-white"
                    style={{ border: '1px solid #e7e5e4', borderRadius: 14, padding: '13px 12px 9px' }}
                >
                    <div className="mb-[2px] flex items-center justify-between px-[2px]">
                        <span
                            className="uppercase text-[#a8a29e]"
                            style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em' }}
                        >
                            {t.historikk.plasseringOverTid}
                        </span>
                        <span
                            className="flex items-center gap-1 text-[#a8a29e]"
                            style={{ fontSize: 10, fontWeight: 700 }}
                        >
                            <ArrowUp size={12} /> {t.historikk.bedre.toUpperCase()}
                        </span>
                    </div>
                    {markert && (
                        <p className="mb-[6px] px-[2px] text-[13px] text-stone-500">
                            {folgDeler[0]}
                            <span style={{ color: markert.farge, fontWeight: 700 }}>{markert.navn}</span>
                            {folgDeler[1]}
                        </p>
                    )}
                    <BumpChart
                        serier={tegnede}
                        kampdagerShort={kampdager.map((d) => d.short)}
                        selectedId={markert?.userid ?? ''}
                        maxRank={maxRank}
                    />
                    {kampdager.length === 1 && (
                        <p className="mt-[4px] px-[2px] text-center text-[11.5px] text-stone-400">
                            {t.historikk.merKommer}
                        </p>
                    )}
                </div>
            </div>

            {/* Markert-kort */}
            {markert && (
                <div className="px-[14px] pt-[12px]">
                    <div
                        className="flex items-center justify-between bg-white"
                        style={{ border: '1px solid #e7e5e4', borderRadius: 14, padding: '11px 14px' }}
                    >
                        <div className="flex min-w-0 items-center gap-[11px]">
                            <Avatar
                                src={historikk.pictures.get(markert.userid)}
                                name={markert.navn}
                                farge={markert.farge}
                            />
                            <div className="min-w-0">
                                <div className="truncate text-[14px] font-bold text-stone-900">{markert.navn}</div>
                                <div className="bp-tabular text-[11px] text-stone-500">
                                    {tx(t.historikk.startetNa, {
                                        start: markert.ranks[0],
                                        na: markert.ranks[sisteIdx],
                                    })}
                                </div>
                            </div>
                        </div>
                        <span
                            className="bp-tabular shrink-0"
                            style={{
                                ...pilleStil,
                                fontSize: 12,
                                fontWeight: 800,
                                borderRadius: 999,
                                padding: '4px 10px',
                            }}
                        >
                            {pilleTekst}
                        </span>
                    </div>
                </div>
            )}

            {/* Deltaker-velger */}
            <div className="px-[14px] pb-[24px] pt-[16px]">
                <p className="bp-overline mb-[9px] text-stone-400">{t.historikk.markerSpiller}</p>

                {erStorLiga && (
                    <div className="relative mb-[10px]">
                        <Search
                            size={15}
                            className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2 text-stone-400"
                        />
                        <input
                            type="text"
                            value={sok}
                            onChange={(e) => setSok(e.target.value)}
                            placeholder={t.historikk.finnDeltaker}
                            className="w-full rounded-[12px] border border-stone-200 bg-white py-[10px] pl-[34px] pr-[12px] text-[14px] text-stone-900 placeholder:text-stone-400 focus-visible:outline-2 focus-visible:outline-amber-500"
                            style={{ minHeight: 44 }}
                        />
                    </div>
                )}

                <div className="flex flex-wrap gap-[8px]">
                    {chipSerier.map((s) => {
                        const valgt = s.userid === markert?.userid
                        return (
                            <button
                                key={s.userid}
                                type="button"
                                onClick={() => {
                                    setValgtId(s.userid)
                                    setSok('')
                                }}
                                className="flex items-center gap-[7px] rounded-full px-[11px] transition-all"
                                style={{
                                    minHeight: 44,
                                    background: valgt ? '#fff' : 'transparent',
                                    border: `1px solid ${valgt ? s.farge : '#e7e5e4'}`,
                                    boxShadow: valgt ? '0 1px 3px rgba(0,0,0,.10)' : undefined,
                                }}
                            >
                                <span
                                    className="inline-block rounded-full"
                                    style={{ width: 18, height: 18, background: s.farge, opacity: valgt ? 1 : 0.5 }}
                                />
                                <span
                                    className={cn(
                                        'text-[13px]',
                                        valgt ? 'font-bold text-stone-900' : 'font-semibold text-stone-500',
                                    )}
                                >
                                    {s.navn}
                                </span>
                            </button>
                        )
                    })}
                    {sok.trim() && sokTreff.length === 0 && (
                        <span className="py-[10px] text-[13px] text-stone-400">—</span>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Historikk
