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
                <label htmlFor={inputId} className="text-sm font-medium text-zinc-700">
                    {label}
                </label>
            )}
            {description && <p className="text-xs text-zinc-500">{description}</p>}
            <input
                id={inputId}
                className={cn(
                    'rounded-md border bg-white px-3 py-1.5 text-sm outline-none',
                    'focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900',
                    'disabled:bg-zinc-100 disabled:cursor-not-allowed',
                    error && 'border-red-500 ring-1 ring-red-400',
                    !error && 'border-zinc-300',
                    size === 'small' ? 'h-7 text-xs' : 'h-9',
                )}
                {...props}
            />
        </div>
    )
}
