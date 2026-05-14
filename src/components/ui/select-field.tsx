import { cn } from '@/lib/utils'
import React from 'react'

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string
    description?: string
}

export function SelectField({ label, description, className, id, children, ...props }: SelectFieldProps) {
    const selectId = id ?? label.toLowerCase().replace(/\s+/g, '-')
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={selectId} className="text-sm font-medium text-zinc-700">
                {label}
            </label>
            {description && <p className="text-xs text-zinc-500">{description}</p>}
            <select
                id={selectId}
                className={cn(
                    'h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-zinc-900',
                    'disabled:bg-zinc-100 disabled:cursor-not-allowed',
                    className,
                )}
                {...props}
            >
                {children}
            </select>
        </div>
    )
}
