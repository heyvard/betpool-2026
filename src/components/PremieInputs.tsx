import { TextField } from '@/components/ui/text-field'
import { cn } from '@/lib/utils'
import { Medalje } from './ui/medalje'
import { useLanguage } from '../i18n/LanguageContext'
import { tx } from '../i18n/interpolate'

export interface ProsentState {
    forste: string
    andre: string
    tredje: string
}

function PremieFelt({ plass, value, onChange }: { plass: 1 | 2 | 3; value: string; onChange: (v: string) => void }) {
    const { t } = useLanguage()
    const tekst = t.felles.plass(plass)
    return (
        <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
                <Medalje plass={plass} size={16} />
                {tekst}
            </span>
            <TextField
                label={tekst}
                hideLabel
                type="number"
                min={0}
                max={100}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    )
}

// Tre inputs for premiefordeling i prosent (1./2./3. plass), brukt både i
// opprett- og rediger-skjemaet. Viser løpende sum og rød advarsel hvis summen
// overstiger 100 — selve valideringen skjer på serveren.
export function PremieInputs({
    verdier,
    onChange,
}: {
    verdier: ProsentState
    onChange: (felt: keyof ProsentState, verdi: string) => void
}) {
    const { t } = useLanguage()
    const sum =
        (parseInt(verdier.forste, 10) || 0) + (parseInt(verdier.andre, 10) || 0) + (parseInt(verdier.tredje, 10) || 0)
    const overSum = sum > 100
    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-stone-700">{t.premieInputs.label}</label>
            <p className="text-xs text-stone-500">{t.premieInputs.beskrivelse}</p>
            <div className="grid grid-cols-3 gap-2">
                <PremieFelt plass={1} value={verdier.forste} onChange={(v) => onChange('forste', v)} />
                <PremieFelt plass={2} value={verdier.andre} onChange={(v) => onChange('andre', v)} />
                <PremieFelt plass={3} value={verdier.tredje} onChange={(v) => onChange('tredje', v)} />
            </div>
            <p className={cn('text-xs', overSum ? 'font-medium text-red-600' : 'text-stone-500')}>
                {overSum ? tx(t.premieInputs.sumFeil, { prosent: sum }) : tx(t.premieInputs.sum, { prosent: sum })}
            </p>
        </div>
    )
}
