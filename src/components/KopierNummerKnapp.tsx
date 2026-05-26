import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '../i18n/LanguageContext'
import { tx } from '../i18n/interpolate'

export function KopierNummerKnapp({ nummer }: { nummer: string }) {
    const { t } = useLanguage()
    const [kopiert, setKopiert] = useState(false)

    async function kopier() {
        try {
            await navigator.clipboard.writeText(nummer)
            setKopiert(true)
            setTimeout(() => setKopiert(false), 2000)
        } catch {
            // clipboard kan være utilgjengelig (eldre nettlesere / ikke-https) — vis fortsatt feedback
            setKopiert(true)
            setTimeout(() => setKopiert(false), 2000)
        }
    }

    return (
        <Button
            variant="accent"
            size="default"
            onClick={kopier}
            icon={kopiert ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        >
            {kopiert ? t.kopier.kopiert : tx(t.kopier.kopier, { nummer })}
        </Button>
    )
}
