import { cn } from '@/lib/utils'
import React from 'react'

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label: string
    hideLabel?: boolean
    error?: boolean
    description?: string
    size?: 'small' | 'default'
}

export function TextField({ label, hideLabel, error, description, size, className, id, ...props }: TextFieldProps) {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
    return (
        <div className={cn('flex flex-col gap-1', className)}>
            {!hideLabel && (
                <label htmlFor={inputId} className="text-sm font-medium text-stone-700">
                    {label}
                </label>
            )}
            {description && <p className="text-xs text-stone-500">{description}</p>}
            <input
                id={inputId}
                className={cn(
                    'rounded-lg border bg-white px-3 py-1.5 text-sm outline-hidden transition-shadow',
                    'focus:ring-2 focus:ring-amber-400 focus:border-amber-500',
                    'disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed',
                    error && 'border-red-500 ring-1 ring-red-400',
                    !error && 'border-stone-300',
                    size === 'small' ? 'h-7 text-xs' : 'h-9',
                )}
                {...props}
            />
        </div>
    )
}
