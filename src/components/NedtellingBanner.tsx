import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import NextLink from 'next/link'
import { hentFlag, hentNavn } from '../utils/lag'
import { nå } from '../utils/testClock'
import { useLanguage } from '../i18n/LanguageContext'
import type { Match } from '../types/types'

const VINDU_MS = 2 * 60 * 60 * 1000
const pad = (n: number) => String(n).padStart(2, '0')

export function NedtellingBanner({ kamp }: { kamp: Match }) {
    const { t, locale } = useLanguage()
    const mål = dayjs(kamp.game_start).valueOf()

    const [restMs, setRestMs] = useState(() => Math.max(0, mål - nå().valueOf()))

    useEffect(() => {
        // Offset mellom testklokka og veggklokka, regnet ut én gang,
        // slik at vi tikker på ekte sekunder uten å miste en evt. testforskyvning.
        const offset = nå().valueOf() - Date.now()
        const tikk = () => setRestMs(Math.max(0, mål - (Date.now() + offset)))
        tikk()
        const id = setInterval(tikk, 1000)
        return () => clearInterval(id)
    }, [mål])

    const totalSek = Math.floor(restMs / 1000)
    const timer = Math.floor(totalSek / 3600)
    const min = Math.floor((totalSek % 3600) / 60)
    const sek = totalSek % 60
    const frem = Math.min(1, Math.max(0, 1 - restMs / VINDU_MS))

    return (
        <NextLink href="/my-bets/" className="block rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-600 motion-safe:animate-pulse" />
                        {t.hjem.avsparkOm}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-bold text-amber-900">
                        {hentFlag(kamp.home_team)} {hentNavn(kamp.home_team, locale)} – {hentFlag(kamp.away_team)}{' '}
                        {hentNavn(kamp.away_team, locale)}
                    </span>
                </div>
                <span className="shrink-0 font-mono text-xl font-medium tabular-nums text-amber-900">
                    {pad(timer)}
                    <span className="text-amber-600 motion-safe:animate-pulse">:</span>
                    {pad(min)}
                    <span className="text-amber-600 motion-safe:animate-pulse">:</span>
                    {pad(sek)}
                </span>
            </div>

            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-amber-700/15">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600 transition-[width] duration-1000 ease-linear"
                    style={{ width: `${(frem * 100).toFixed(2)}%` }}
                />
            </div>
        </NextLink>
    )
}
