import { cn } from '@/lib/utils'

const variants = {
    warning: 'bg-amber-50 border-l-amber-500 border-amber-200 text-amber-900',
    info: 'bg-blue-50 border-l-blue-500 border-blue-200 text-blue-900',
    error: 'bg-red-50 border-l-red-500 border-red-200 text-red-900',
    success: 'bg-emerald-50 border-l-emerald-500 border-emerald-200 text-emerald-900',
}

interface AlertProps {
    variant?: keyof typeof variants
    className?: string
    children: React.ReactNode
}

export function Alert({ variant = 'info', className, children }: AlertProps) {
    return (
        <div
            role="alert"
            className={cn('rounded-lg border border-l-4 px-4 py-3 text-sm shadow-sm', variants[variant], className)}
        >
            {children}
        </div>
    )
}
