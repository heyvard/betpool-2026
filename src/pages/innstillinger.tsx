import type { NextPage } from 'next'
import React, { useState } from 'react'
import { Check } from 'lucide-react'

import { TextField } from '@/components/ui/text-field'
import { Button } from '@/components/ui/button'
import { Spinner } from '../components/loading/Spinner'
import { UseUser } from '../queries/useUser'
import { UseMutateKallenavn } from '../queries/mutateKallenavn'
import { useLanguage } from '../i18n/LanguageContext'

const MAKS_LENGDE = 30

const Innstillinger: NextPage = () => {
    const { data: megselv } = UseUser()
    const mutate = UseMutateKallenavn()
    const { t } = useLanguage()
    // Utkast holdes som overstyring av den lagrede verdien — `null` betyr «ikke
    // rørt», da vises kallenavnet fra serveren. Slik slipper vi å seede state i
    // en effect (cascading renders), og feltet følger refetch etter lagring.
    const [utkast, setUtkast] = useState<string | null>(null)

    if (!megselv) {
        return <Spinner />
    }

    const lagret = megselv.kallenavn ?? ''
    const kallenavn = utkast ?? lagret
    const endret = kallenavn.trim() !== lagret

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-stone-900">{t.innstillinger.tittel}</h1>

            <div className="bp-card space-y-3">
                <div>
                    <p className="font-semibold text-stone-900">{t.innstillinger.kallenavnTittel}</p>
                    <p className="text-sm text-stone-600">{t.innstillinger.kallenavnBeskrivelse}</p>
                </div>

                <TextField
                    label={t.innstillinger.kallenavnLabel}
                    hideLabel
                    value={kallenavn}
                    maxLength={MAKS_LENGDE}
                    placeholder={t.innstillinger.kallenavnPlaceholder}
                    onChange={(e) => setUtkast(e.target.value)}
                    error={mutate.isError}
                />

                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => mutate.mutate(kallenavn.trim())}
                        loading={mutate.isPending}
                        disabled={mutate.isPending || !endret}
                    >
                        {t.innstillinger.lagre}
                    </Button>
                    {mutate.isPending && <span className="text-xs text-stone-500">{t.felles.lagrer}</span>}
                    {!mutate.isPending && mutate.isSuccess && !endret && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <Check className="h-3.5 w-3.5" /> {t.felles.lagret}
                        </span>
                    )}
                    {mutate.isError && <span className="text-xs text-red-600">{t.felles.feil}</span>}
                </div>
            </div>
        </div>
    )
}

export default Innstillinger
