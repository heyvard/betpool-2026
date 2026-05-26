import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'bg-stone-900 text-white hover:bg-stone-800 active:bg-stone-950 shadow-xs',
                accent: 'bg-amber-500 text-stone-950 hover:bg-amber-400 active:bg-amber-600 shadow-xs font-semibold',
                outline: 'border border-stone-300 bg-white hover:bg-stone-50 text-stone-900',
                ghost: 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
            },
            size: {
                default: 'h-9 px-4 py-2',
                small: 'h-7 px-3 text-xs',
                icon: 'h-9 w-9',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    loading?: boolean
    icon?: React.ReactNode
}

export function Button({ className, variant, size, loading, icon, children, disabled, ...props }: ButtonProps) {
    return (
        <button className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
            {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
                icon
            )}
            {children}
        </button>
    )
}
