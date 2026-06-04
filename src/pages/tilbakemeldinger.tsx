import type { NextPage } from 'next'
import React from 'react'
import dayjs from 'dayjs'

import { Spinner } from '../components/loading/Spinner'
import { Button } from '@/components/ui/button'
import { UseUser } from '../queries/useUser'
import { UseTilbakemeldinger, Tilbakemelding } from '../queries/useTilbakemeldinger'
import { UseSettBehandlet } from '../queries/mutateBehandletTilbakemelding'
import { useLanguage } from '../i18n/LanguageContext'

function TilbakemeldingKort({ tb }: { tb: Tilbakemelding }) {
    const { t } = useLanguage()
    const settBehandlet = UseSettBehandlet()
    const behandlet = tb.behandlet_at != null

    return (
        <div className="bp-card space-y-2">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-semibold text-stone-900">{tb.name}</p>
                    <p className="text-xs text-stone-500">{dayjs(tb.created_at).format('DD.MM.YYYY HH:mm')}</p>
                </div>
                {behandlet ? (
                    <span className="bp-chip-green shrink-0">{t.tilbakemelding.behandlet}</span>
                ) : (
                    <span className="bp-chip-blue shrink-0">{t.tilbakemelding.ubehandlet}</span>
                )}
            </div>

            <p className="whitespace-pre-wrap text-sm text-stone-700">{tb.message}</p>

            <Button
                variant="outline"
                size="small"
                loading={settBehandlet.isPending}
                onClick={() => settBehandlet.mutate({ id: tb.id, behandlet: !behandlet })}
            >
                {behandlet ? t.tilbakemelding.angreBehandlet : t.tilbakemelding.markerBehandlet}
            </Button>
        </div>
    )
}

const Tilbakemeldinger: NextPage = () => {
    const { data: me } = UseUser()
    const { data: tilbakemeldinger } = UseTilbakemeldinger()
    const { t } = useLanguage()

    if (!me || !tilbakemeldinger) {
        return <Spinner />
    }

    if (!me.superadmin) {
        return null
    }

    return (
        <div className="space-y-3">
            <h1 className="text-2xl font-bold text-stone-900">{t.tilbakemelding.adminTittel}</h1>
            {tilbakemeldinger.length === 0 ? (
                <p className="text-sm text-stone-600">{t.tilbakemelding.ingen}</p>
            ) : (
                tilbakemeldinger.map((tb) => <TilbakemeldingKort key={tb.id} tb={tb} />)
            )}
        </div>
    )
}

export default Tilbakemeldinger
