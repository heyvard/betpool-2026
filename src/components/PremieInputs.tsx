import { TextField } from '@/components/ui/text-field'
import { cn } from '@/lib/utils'

export interface ProsentState {
    forste: string
    andre: string
    tredje: string
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
    const sum =
        (parseInt(verdier.forste, 10) || 0) + (parseInt(verdier.andre, 10) || 0) + (parseInt(verdier.tredje, 10) || 0)
    const overSum = sum > 100
    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-stone-700">Premiefordeling (%)</label>
            <p className="text-xs text-stone-500">
                Valgfritt. Hvor stor andel av potten som går til 1./2./3. plass. Resten holdes utenom.
            </p>
            <div className="grid grid-cols-3 gap-2">
                <TextField
                    label="🥇 1. plass"
                    type="number"
                    min={0}
                    max={100}
                    value={verdier.forste}
                    onChange={(e) => onChange('forste', e.target.value)}
                />
                <TextField
                    label="🥈 2. plass"
                    type="number"
                    min={0}
                    max={100}
                    value={verdier.andre}
                    onChange={(e) => onChange('andre', e.target.value)}
                />
                <TextField
                    label="🥉 3. plass"
                    type="number"
                    min={0}
                    max={100}
                    value={verdier.tredje}
                    onChange={(e) => onChange('tredje', e.target.value)}
                />
            </div>
            <p className={cn('text-xs', overSum ? 'font-medium text-red-600' : 'text-stone-500')}>
                Sum: {sum}%{overSum && ' — må være ≤ 100 %'}
            </p>
        </div>
    )
}
