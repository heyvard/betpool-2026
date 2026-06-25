import type { NextPage } from 'next'
import { Spinner } from '../../components/loading/Spinner'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { UseAllBets } from '../../queries/useAllBets'
import React from 'react'
import { fixLand } from '../../components/bet/BetView'
import NextLink from 'next/link'
import { CheckCheck, ChevronRight, Goal, Target, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '../../i18n/LanguageContext'
import { RundeSeksjon, Legende } from '../../components/bet/PastBetView'
import { UseUser } from '../../queries/useUser'
import { calculateAllBetsExtended, filtrerAllBets } from '../../components/results/calculateAllBetsExtended'

// Én rad i vinner/toppscorer-kortet — samme rad-språk som ResultatRad:
// ikon-medaljong, overline-label, tippet verdi og en gull-poeng-pill med chevron.
function BonusRad({
    icon,
    label,
    verdi,
    poengTekst,
    borderTop,
}: {
    icon: React.ReactNode
    label: string
    verdi: string
    poengTekst: string
    borderTop?: boolean
}) {
    return (
        <NextLink
            href="/alle-tips"
            className={cn(
                'flex items-center gap-3 px-[13px] py-3 transition-colors hover:bg-stone-50 active:bg-stone-100',
                borderTop && 'border-t border-[#f0efed]',
            )}
        >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-100">{icon}</div>
            <div className="min-w-0 flex-1">
                <div className="bp-overline text-[10px] tracking-[0.14em]">{label}</div>
                <div className="truncate text-[14px] font-bold text-stone-900">{verdi}</div>
            </div>
            <span className="bp-chip-gold bp-tabular shrink-0">{poengTekst}</span>
            <ChevronRight className="h-[14px] w-[14px] shrink-0 text-[#cbc9c4]" />
        </NextLink>
    )
}

const AVATAR_FARGER = ['bg-rose-400', 'bg-amber-400', 'bg-emerald-500', 'bg-blue-500', 'bg-violet-500']

const Home: NextPage = () => {
    const { data, isLoading } = UseAllBets()
    const { data: currentUser } = UseUser()
    const { t, locale } = useLanguage()
    const router = useRouter()
    const { id } = router.query

    if (!data || isLoading) return <Spinner />

    // Poeng må regnes ut over hovedliga-populasjonen (samme som ledertavla),
    // ikke hele brukermassen. Raritets-vektingen i regnUtScoreForKamp avhenger
    // av hvor stor andel av populasjonen som traff, så en global beregning gir
    // andre poeng enn ledertavla viser. Den betraktede brukeren legges alltid
    // til i populasjonen, slik at også ikke-hovedliga-brukere får poeng.
    const populasjon = new Set(data.raw.users.filter((u) => u.i_hovedliga !== false).map((u) => u.id))
    populasjon.add(String(id))
    const { users, bets } = calculateAllBetsExtended(filtrerAllBets(data.raw, populasjon))

    const user = users.find((a) => a.id == id)!

    const userBets = bets
        .filter((a) => a.user_id == id)
        .sort((a, b) => dayjs(b.game_start).unix() - dayjs(a.game_start).unix())

    // Toppsum = ferdigspilte kamp-poeng + vinner/toppscorer-bonus, akkurat som
    // calculateLeaderboard summerer på ledertavla.
    const ferdigeBets = userBets.filter((b) => !b.foreløpig)
    const totalPoeng =
        ferdigeBets.reduce((sum, b) => sum + b.poeng, 0) + (user.winnerPoints ?? 0) + (user.topscorerPoints ?? 0)

    // Treff-statistikk over ferdigspilte kamper (samme populasjon som totalPoeng).
    // riktigUtfall inkluderer riktigResultat (eksakt skår er også riktig utfall),
    // slik at antall utfall alltid er ≥ antall resultat.
    const antallRiktigUtfall = ferdigeBets.filter((b) => b.riktigUtfall).length
    const antallRiktigResultat = ferdigeBets.filter((b) => b.riktigResultat).length

    const rundeMap = new Map<number, typeof userBets>()
    userBets.forEach((bet) => {
        if (!rundeMap.has(bet.round)) rundeMap.set(bet.round, [])
        rundeMap.get(bet.round)!.push(bet)
    })
    const runder = [...rundeMap.entries()].sort(([a], [b]) => b - a)

    const avatarFarge = AVATAR_FARGER[Math.abs((user.name.charCodeAt(0) || 0) % AVATAR_FARGER.length)]
    const undertittel = locale === 'fr' ? 'ses résultats' : 'sine resultater'
    const poengChip = (p: number) => `${p > 0 ? `+${p}` : p} ${t.felles.poeng}`

    return (
        <div className="pb-8">
            {/* Profil-header */}
            <div className="bg-white border-b border-[#e7e5e4] px-4 py-[14px]">
                <div className="flex items-center gap-3">
                    <div className="shrink-0">
                        {user.picture ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={user.picture} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${avatarFarge}`}
                            >
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[17px] font-extrabold tracking-[-0.01em] text-[#1c1917] truncate">
                            {user.name}
                        </div>
                        <div className="text-[11.5px] text-[#78716c]">{undertittel}</div>
                    </div>
                    <div className="shrink-0 text-right">
                        <div className="bp-tabular text-[22px] font-extrabold text-[#b45309] leading-none">
                            {totalPoeng}
                        </div>
                        <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#a8a29e] whitespace-nowrap mt-0.5">
                            {t.spilteKamper.poengTotalt}
                        </div>
                    </div>
                </div>

                {/* Treff-statistikk — antall riktig utfall og riktig resultat */}
                {ferdigeBets.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] px-2.5 py-1">
                            <Target className="h-3.5 w-3.5 shrink-0 text-[#f59e0b]" />
                            <span className="bp-tabular text-[13px] font-extrabold text-[#92400e]">
                                {antallRiktigUtfall}
                            </span>
                            <span className="text-[11px] font-semibold text-[#92400e]">
                                {t.spilteKamper.riktigUtfall.toLowerCase()}
                            </span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-2.5 py-1">
                            <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[#16a34a]" />
                            <span className="bp-tabular text-[13px] font-extrabold text-[#15803d]">
                                {antallRiktigResultat}
                            </span>
                            <span className="text-[11px] font-semibold text-[#15803d]">
                                {t.spilteKamper.riktigResultat.toLowerCase()}
                            </span>
                        </span>
                    </div>
                )}
            </div>

            {/* Vinner / Toppscorer */}
            {user.winner && (
                <div className="mx-4 mt-4 overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-stone-200/70">
                    <BonusRad
                        icon={<Trophy className="h-[18px] w-[18px] text-gold-700" />}
                        label={t.allesTips.toggleVinner}
                        verdi={fixLand(user.winner || '', locale)}
                        poengTekst={poengChip(user.winnerPoints ?? 0)}
                    />
                    <BonusRad
                        icon={<Goal className="h-[18px] w-[18px] text-gold-700" />}
                        label={t.allesTips.toggleToppscorer}
                        verdi={user.topscorer_player_name || '–'}
                        poengTekst={poengChip(user.topscorerPoints ?? 0)}
                        borderTop
                    />
                </div>
            )}

            {/* Ingen resultater */}
            {userBets.length === 0 && (
                <div className="text-center text-[#a8a29e] text-sm py-8">{t.spilteKamper.ingenResultater}</div>
            )}

            {/* Runder (nyeste først) */}
            {runder.map(([runde, bets]) => (
                <RundeSeksjon
                    key={runde}
                    runde={runde}
                    bets={bets}
                    locale={locale}
                    erEgenProfil={currentUser?.id === id}
                />
            ))}

            {/* Legende */}
            {userBets.length > 0 && <Legende />}
        </div>
    )
}

export default Home
