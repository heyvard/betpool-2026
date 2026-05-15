import { cn } from '@/lib/utils'
import React from 'react'

interface LinkPanelProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    children: React.ReactNode
}

export const LinkPanel = React.forwardRef<HTMLAnchorElement, LinkPanelProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <a
                ref={ref}
                className={cn(
                    'group flex items-center justify-between rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-stone-200/70',
                    'hover:bg-stone-50 hover:ring-amber-300/60 hover:shadow active:bg-stone-100 transition-all',
                    className,
                )}
                {...props}
            >
                <span>{children}</span>
                <svg
                    className="h-4 w-4 text-stone-400 group-hover:text-amber-500 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </a>
        )
    },
)
LinkPanel.displayName = 'LinkPanel'
