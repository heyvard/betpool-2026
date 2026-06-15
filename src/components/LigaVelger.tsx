import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LeagueSummary } from '../types/league'
import { useLanguage } from '../i18n/LanguageContext'

export function LigaVelger({
    ligaer,
    valgt,
    onVelg,
    antallHovedliga = 0,
}: {
    ligaer: LeagueSummary[]
    valgt: string | null
    onVelg: (id: string | null) => void
    antallHovedliga?: number
}) {
    const { t } = useLanguage()
    const mine = ligaer.filter((l) => l.my_status === 'medlem')
    const [åpen, setÅpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!åpen) return
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setÅpen(false)
            }
        }
        document.addEventListener('mousedown', onClickOutside)
        return () => document.removeEventListener('mousedown', onClickOutside)
    }, [åpen])

    const valgtLiga = mine.find((l) => l.id === valgt)
    const displayNavn = valgt && valgtLiga ? valgtLiga.name : t.ledertavle.hovedligaen

    const underTekst =
        valgt && valgtLiga
            ? `${valgtLiga.name} · ${valgtLiga.member_count} ${t.ledertavle.deltakere}`
            : `${t.ledertavle.hovedligaen} · ${antallHovedliga} ${t.ledertavle.deltakere}`

    return (
        <div ref={ref}>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setÅpen((v) => !v)}
                    aria-expanded={åpen}
                    aria-haspopup="listbox"
                    style={{ minHeight: 44 }}
                    className={cn(
                        'mt-[9px] flex w-full items-center justify-between rounded-[14px] border border-stone-200 bg-stone-50',
                        'px-[15px] py-[13px] text-left transition-all',
                        'focus-visible:outline-2 focus-visible:outline-amber-500',
                        åpen && 'border-amber-500 ring-2 ring-amber-400',
                    )}
                >
                    <span className="text-[19px] font-extrabold leading-none tracking-[-0.01em] text-stone-900">
                        {displayNavn}
                    </span>
                    <ChevronDown
                        size={20}
                        className={cn(
                            'shrink-0 text-stone-400 transition-transform duration-200',
                            åpen && 'rotate-180',
                        )}
                    />
                </button>

                {åpen && (
                    <div
                        className="absolute left-0 right-0 z-50 overflow-hidden rounded-[16px] bg-white p-[6px]"
                        style={{
                            top: 'calc(100% + 6px)',
                            border: '1px solid #e7e5e4',
                            boxShadow: '0 18px 44px rgba(28,25,23,.18)',
                        }}
                        role="listbox"
                        aria-label={t.ledertavle.velgLiga}
                    >
                        <button
                            type="button"
                            role="option"
                            aria-selected={valgt === null}
                            onClick={() => {
                                onVelg(null)
                                setÅpen(false)
                            }}
                            className="flex w-full items-center justify-between rounded-[10px] px-[13px] py-[11px] text-left text-[14px] font-semibold text-stone-900 transition-colors hover:bg-stone-100"
                        >
                            <span>{t.ledertavle.hovedligaen}</span>
                            {valgt === null && <span className="text-[14px] font-bold text-amber-700">✓</span>}
                        </button>

                        {mine.map((l) => (
                            <button
                                key={l.id}
                                type="button"
                                role="option"
                                aria-selected={valgt === l.id}
                                onClick={() => {
                                    onVelg(l.id)
                                    setÅpen(false)
                                }}
                                className="flex w-full items-center justify-between rounded-[10px] px-[13px] py-[11px] text-left text-[14px] font-semibold text-stone-900 transition-colors hover:bg-stone-100"
                            >
                                <span>{l.name}</span>
                                {valgt === l.id && <span className="text-[14px] font-bold text-amber-700">✓</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <p className="mt-[5px] px-[2px] text-[11.5px] leading-none text-stone-400">{underTekst}</p>
        </div>
    )
}
