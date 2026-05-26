import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

interface SwitchProps extends React.ComponentProps<typeof SwitchPrimitive.Root> {
    children?: React.ReactNode
    loading?: boolean
    size?: 'small' | 'default'
}

export function Switch({ children, loading, size, className, ...props }: SwitchProps) {
    return (
        <label className="flex items-center gap-2 cursor-pointer select-none">
            <SwitchPrimitive.Root
                className={cn(
                    'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                    'transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'data-[state=checked]:bg-stone-900 data-[state=unchecked]:bg-stone-300',
                    size === 'small' ? 'h-4 w-7' : 'h-5 w-9',
                    loading && 'opacity-60 pointer-events-none',
                    className,
                )}
                {...props}
            >
                <SwitchPrimitive.Thumb
                    className={cn(
                        'pointer-events-none block rounded-full bg-white shadow-xs ring-0 transition-transform',
                        size === 'small'
                            ? 'h-3 w-3 data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0'
                            : 'h-4 w-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
                    )}
                />
            </SwitchPrimitive.Root>
            {children && <span className="text-sm">{children}</span>}
        </label>
    )
}
