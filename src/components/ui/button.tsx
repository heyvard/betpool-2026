import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default:
                    'bg-stone-900 text-white hover:bg-stone-800 active:bg-stone-950 focus-visible:outline-2 focus-visible:outline-amber-500 disabled:bg-stone-300 disabled:text-stone-500',
                accent: 'bg-amber-500 text-stone-900 font-bold hover:bg-amber-400 active:bg-amber-600 shadow-gold focus-visible:outline-2 focus-visible:outline-stone-900',
                outline:
                    'bg-white text-stone-900 ring-1 ring-stone-200 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-amber-500',
                ghost: 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
            },
            size: {
                default: 'min-h-11 px-4 text-sm',
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
