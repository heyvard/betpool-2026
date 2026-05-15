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
            <label htmlFor={selectId} className="text-sm font-medium text-stone-700">
                {label}
            </label>
            {description && <p className="text-xs text-stone-500">{description}</p>}
            <select
                id={selectId}
                className={cn(
                    'h-9 rounded-lg border border-stone-300 bg-white px-3 text-sm transition-shadow',
                    'focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500',
                    'disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed',
                    className,
                )}
                {...props}
            >
                {children}
            </select>
        </div>
    )
}
