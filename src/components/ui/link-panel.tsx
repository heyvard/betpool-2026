import { cn } from '@/lib/utils'
import React from 'react'

interface LinkPanelProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    children: React.ReactNode
}

export const LinkPanel = React.forwardRef<HTMLAnchorElement, LinkPanelProps>(({ className, children, ...props }, ref) => {
    return (
        <a
            ref={ref}
            className={cn(
                'flex items-center justify-between rounded-xl bg-white px-5 py-4 shadow',
                'hover:bg-zinc-50 transition-colors',
                className,
            )}
            {...props}
        >
            <span>{children}</span>
            <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </a>
    )
})
LinkPanel.displayName = 'LinkPanel'
