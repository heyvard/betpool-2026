import { cn } from '@/lib/utils'
import React from 'react'

interface TextProps {
    children?: React.ReactNode
    className?: string
    spacing?: boolean
    align?: 'left' | 'center' | 'right'
}

export function BodyShort({ children, className, spacing, align }: TextProps) {
    return (
        <p
            className={cn(
                'text-sm',
                spacing && 'mb-3',
                align === 'center' && 'text-center',
                align === 'right' && 'text-right',
                className,
            )}
        >
            {children}
        </p>
    )
}

export function BodyLong({ children, className, spacing, align }: TextProps) {
    return (
        <p
            className={cn(
                'text-sm leading-relaxed',
                spacing && 'mb-3',
                align === 'center' && 'text-center',
                align === 'right' && 'text-right',
                className,
            )}
        >
            {children}
        </p>
    )
}

const headingSizes = {
    xlarge: 'text-3xl font-bold',
    large: 'text-2xl font-bold',
    medium: 'text-xl font-semibold',
    small: 'text-base font-semibold',
    xsmall: 'text-sm font-semibold',
} as const

const headingTags = {
    '1': 'h1',
    '2': 'h2',
    '3': 'h3',
    '4': 'h4',
    '5': 'h5',
    '6': 'h6',
} as const

interface HeadingProps extends TextProps {
    size?: keyof typeof headingSizes
    level?: keyof typeof headingTags
}

export function Heading({ children, className, spacing, align, size = 'medium', level = '2' }: HeadingProps) {
    const Tag = headingTags[level] as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
    return (
        <Tag
            className={cn(
                headingSizes[size],
                spacing && 'mb-3',
                align === 'center' && 'text-center',
                align === 'right' && 'text-right',
                className,
            )}
        >
            {children}
        </Tag>
    )
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    children: React.ReactNode
}

export function Link({ children, className, ...props }: LinkProps) {
    return (
        <a className={cn('text-blue-600 hover:underline', className)} {...props}>
            {children}
        </a>
    )
}
