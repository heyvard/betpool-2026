import { cn } from '@/lib/utils'

const variants = {
    warning: 'bg-amber-50 border-amber-300 text-amber-900',
    info: 'bg-blue-50 border-blue-300 text-blue-900',
    error: 'bg-red-50 border-red-300 text-red-900',
    success: 'bg-green-50 border-green-300 text-green-900',
}

interface AlertProps {
    variant?: keyof typeof variants
    className?: string
    children: React.ReactNode
}

export function Alert({ variant = 'info', className, children }: AlertProps) {
    return (
        <div role="alert" className={cn('rounded-lg border px-4 py-3 text-sm', variants[variant], className)}>
            {children}
        </div>
    )
}
