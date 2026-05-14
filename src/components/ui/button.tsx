import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'bg-zinc-900 text-white hover:bg-zinc-800',
                outline: 'border border-zinc-300 bg-white hover:bg-zinc-50',
                ghost: 'hover:bg-zinc-100',
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
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
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
