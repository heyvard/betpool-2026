import React, { useState } from 'react'
import { TextField } from '@/components/ui/text-field'
import { Button } from '@/components/ui/button'
import { Megaphone } from 'lucide-react'
import { UseSendPushAlle, SendPushAlleResultat } from '../../queries/mutateSendPush'

// Forhåndsutfylt melding om at vinner/toppscorer-tipsene lukker i dag. Admin
// kan justere før sending.
const STANDARD = {
    tittel: 'Siste sjanse ⏳',
    melding: 'I dag lukker muligheten for å tippe vinner og toppscorer.',
    url: '/',
}

export function PushAlleSkjema() {
    const [tittel, setTittel] = useState(STANDARD.tittel)
    const [melding, setMelding] = useState(STANDARD.melding)
    const [url, setUrl] = useState(STANDARD.url)
    const [suksess, setSuksess] = useState<SendPushAlleResultat | null>(null)
    const { mutate, isPending, isError, reset } = UseSendPushAlle()

    function send() {
        if (!tittel.trim() || !melding.trim()) return
        if (!window.confirm(`Sende «${tittel.trim()}» til ALLE brukere med varsler på?`)) return
        mutate({ title: tittel, body: melding, url: url || undefined }, { onSuccess: setSuksess })
    }

    if (suksess) {
        return (
            <div className="bp-card space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                    <Megaphone className="h-4 w-4 text-amber-600" />
                    Send til alle
                </div>
                <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                    <span>
                        Sendt til {suksess.brukere} bruker{suksess.brukere !== 1 ? 'e' : ''} ({suksess.enheter} enhet
                        {suksess.enheter !== 1 ? 'er' : ''}).
                    </span>
                    <button
                        onClick={() => {
                            setSuksess(null)
                            reset()
                        }}
                        className="text-xs underline"
                    >
                        Send en til
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="bp-card space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                <Megaphone className="h-4 w-4 text-amber-600" />
                Send til alle
            </div>
            <p className="text-xs text-stone-500">
                Går til alle aktive brukere som har skrudd på generelle varsler og har en push-enhet.
            </p>
            <TextField label="Tittel" size="small" value={tittel} onChange={(e) => setTittel(e.target.value)} />
            <TextField label="Melding" size="small" value={melding} onChange={(e) => setMelding(e.target.value)} />
            <TextField
                label="URL (valgfritt)"
                size="small"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/"
            />
            <div className="flex items-center gap-2 pt-1">
                <Button
                    variant="default"
                    size="small"
                    loading={isPending}
                    disabled={!tittel.trim() || !melding.trim()}
                    icon={<Megaphone className="h-3.5 w-3.5" />}
                    onClick={send}
                >
                    Send til alle
                </Button>
                {isError && <span className="text-xs text-red-600">Kunne ikke sende — prøv igjen.</span>}
            </div>
        </div>
    )
}
