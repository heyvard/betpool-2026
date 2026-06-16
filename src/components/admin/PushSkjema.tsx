import React, { useState } from 'react'
import { TextField } from '@/components/ui/text-field'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import { UseSendPush, SendPushResultat } from '../../queries/mutateSendPush'

export function PushSkjema({ mottaker, onFerdig }: { mottaker: string; onFerdig?: () => void }) {
    const [tittel, setTittel] = useState('')
    const [melding, setMelding] = useState('')
    const [url, setUrl] = useState('')
    const [suksess, setSuksess] = useState<SendPushResultat | null>(null)
    const { mutate, isPending, isError, reset } = UseSendPush()

    function send() {
        if (!tittel.trim() || !melding.trim()) return
        mutate(
            { userId: mottaker, title: tittel, body: melding, url: url || undefined },
            {
                onSuccess: (resultat) => {
                    setSuksess(resultat)
                    onFerdig?.()
                },
            },
        )
    }

    if (suksess) {
        return (
            <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                <span>
                    Sendt til {suksess.sendt} enhet{suksess.sendt !== 1 ? 'er' : ''}.
                </span>
                <button
                    onClick={() => {
                        setSuksess(null)
                        setTittel('')
                        setMelding('')
                        setUrl('')
                        reset()
                    }}
                    className="text-xs underline"
                >
                    Send en til
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-2 rounded-lg bg-white p-3 ring-1 ring-stone-200">
            <TextField
                label="Tittel"
                size="small"
                value={tittel}
                onChange={(e) => setTittel(e.target.value)}
                placeholder="VM Betpool"
            />
            <TextField
                label="Melding"
                size="small"
                value={melding}
                onChange={(e) => setMelding(e.target.value)}
                placeholder="Husk å tippe kampene i dag!"
            />
            <TextField
                label="URL (valgfritt)"
                size="small"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/my-bets"
            />
            <div className="flex items-center gap-2 pt-1">
                <Button
                    variant="default"
                    size="small"
                    loading={isPending}
                    disabled={!tittel.trim() || !melding.trim()}
                    icon={<Send className="h-3.5 w-3.5" />}
                    onClick={send}
                >
                    Send
                </Button>
                {isError && <span className="text-xs text-red-600">Kunne ikke lagre — prøv igjen.</span>}
            </div>
        </div>
    )
}
