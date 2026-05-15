import { cn } from '@/lib/utils'

export function Table({
    className,
    children,
    size,
}: {
    className?: string
    children: React.ReactNode
    size?: 'small' | 'default'
}) {
    return (
        <div className="w-full overflow-auto">
            <table className={cn('w-full caption-bottom', size === 'small' ? 'text-xs' : 'text-sm', className)}>
                {children}
            </table>
        </div>
    )
}

Table.Header = function TableHeader({ children }: { children: React.ReactNode }) {
    return <thead className="border-b border-stone-200 bg-stone-50/60">{children}</thead>
}

Table.Body = function TableBody({ children }: { children: React.ReactNode }) {
    return <tbody className="divide-y divide-stone-100">{children}</tbody>
}

Table.Row = function TableRow({ children, className }: { children: React.ReactNode; className?: string }) {
    return <tr className={cn('hover:bg-stone-50/70 transition-colors', className)}>{children}</tr>
}

Table.HeaderCell = function TableHeaderCell({
    children,
    align,
    className,
}: {
    children?: React.ReactNode
    align?: 'left' | 'center' | 'right'
    className?: string
}) {
    return (
        <th
            className={cn(
                'h-10 px-3 font-semibold text-stone-600 uppercase tracking-wide text-xs',
                align === 'center' && 'text-center',
                align === 'right' && 'text-right',
                className,
            )}
        >
            {children}
        </th>
    )
}

Table.DataCell = function TableDataCell({
    children,
    align,
    className,
}: {
    children?: React.ReactNode
    align?: 'left' | 'center' | 'right'
    className?: string
}) {
    return (
        <td
            className={cn(
                'px-3 py-2',
                align === 'center' && 'text-center',
                align === 'right' && 'text-right',
                className,
            )}
        >
            {children}
        </td>
    )
}
