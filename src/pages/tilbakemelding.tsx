import type { NextPage } from 'next'
import React, { useState } from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { UseSendTilbakemelding } from '../queries/mutateTilbakemelding'
import { useLanguage } from '../i18n/LanguageContext'

const MAKS_LENGDE = 5000

const Tilbakemelding: NextPage = () => {
    const mutate = UseSendTilbakemelding()
    const { t } = useLanguage()
    const [melding, setMelding] = useState('')

    const kanSende = melding.trim().length > 0 && !mutate.isPending

    function send() {
        if (!kanSende) return
        mutate.mutate(melding.trim(), {
            onSuccess: () => setMelding(''),
        })
    }

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-stone-900">{t.tilbakemelding.tittel}</h1>

            <div className="bp-card space-y-3">
                <p className="text-sm text-stone-600">{t.tilbakemelding.beskrivelse}</p>

                <textarea
                    aria-label={t.tilbakemelding.tittel}
                    value={melding}
                    maxLength={MAKS_LENGDE}
                    rows={6}
                    placeholder={t.tilbakemelding.placeholder}
                    onChange={(e) => {
                        setMelding(e.target.value)
                        // Tilbakestill kvittering når brukeren skriver på nytt.
                        if (mutate.isSuccess || mutate.isError) mutate.reset()
                    }}
                    className={cn(
                        'w-full rounded-lg border bg-white px-3 py-2 text-sm outline-hidden transition-shadow',
                        'focus:ring-2 focus:ring-amber-400 focus:border-amber-500',
                        mutate.isError ? 'border-red-500 ring-1 ring-red-400' : 'border-stone-300',
                    )}
                />

                <div className="flex items-center gap-3">
                    <Button onClick={send} loading={mutate.isPending} disabled={!kanSende}>
                        {t.tilbakemelding.send}
                    </Button>
                    {mutate.isPending && <span className="text-xs text-stone-500">{t.felles.lagrer}</span>}
                    {!mutate.isPending && mutate.isSuccess && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <Check className="h-3.5 w-3.5" /> {t.tilbakemelding.takk}
                        </span>
                    )}
                    {mutate.isError && <span className="text-xs text-red-600">{t.felles.feil}</span>}
                </div>
            </div>
        </div>
    )
}

export default Tilbakemelding
