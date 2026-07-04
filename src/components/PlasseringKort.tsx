import React from 'react'
import NextLink from 'next/link'
import { ArrowDown, ArrowUp, Trophy } from 'lucide-react'

import { Medalje } from './ui/medalje'
import { useMinPlassering } from '../queries/useMinPlassering'
import { useLanguage } from '../i18n/LanguageContext'
import { tx } from '../i18n/interpolate'

export function PlasseringKort() {
    const { t } = useLanguage()
    const plassering = useMinPlassering()

    // Data ikke klare ennå, eller ingen kampdag å plassere på → vis ikke kortet.
    if (!plassering) return null

    const { plass, diff } = plassering

    return (
        <NextLink passHref legacyBehavior href="/leaderboard">
            <a className="block rounded-2xl bg-white shadow-xs ring-1 ring-stone-200/70">
                <div className="flex min-h-16 items-center gap-3 px-4 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        {plass <= 3 ? <Medalje plass={plass as 1 | 2 | 3} size={22} /> : <Trophy className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold text-stone-900">{t.hjem.dinPlass}</h2>
                        {diff != null && (
                            <p
                                className={
                                    diff > 0
                                        ? 'flex items-center gap-1 text-xs font-semibold text-emerald-700'
                                        : diff < 0
                                          ? 'flex items-center gap-1 text-xs font-semibold text-red-700'
                                          : 'text-xs text-stone-500'
                                }
                            >
                                {diff > 0 && <ArrowUp className="h-3 w-3" />}
                                {diff < 0 && <ArrowDown className="h-3 w-3" />}
                                {diff > 0
                                    ? tx(t.hjem.oppSisteKampdag, { n: diff })
                                    : diff < 0
                                      ? tx(t.hjem.nedSisteKampdag, { n: -diff })
                                      : t.hjem.uendretSisteKampdag}
                            </p>
                        )}
                    </div>
                    <span className="text-2xl font-extrabold tabular-nums text-stone-900">{plass}.</span>
                </div>
            </a>
        </NextLink>
    )
}
