import { cn } from '@/lib/utils'

export function Table({ className, children, size }: { className?: string; children: React.ReactNode; size?: 'small' | 'default' }) {
    return (
        <div className="w-full overflow-auto">
            <table className={cn('w-full caption-bottom', size === 'small' ? 'text-xs' : 'text-sm', className)}>
                {children}
            </table>
        </div>
    )
}

Table.Header = function TableHeader({ children }: { children: React.ReactNode }) {
    return <thead className="border-b">{children}</thead>
}

Table.Body = function TableBody({ children }: { children: React.ReactNode }) {
    return <tbody className="divide-y divide-zinc-100">{children}</tbody>
}

Table.Row = function TableRow({ children, className }: { children: React.ReactNode; className?: string }) {
    return <tr className={cn('hover:bg-zinc-50', className)}>{children}</tr>
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
                'h-10 px-3 font-semibold text-zinc-600',
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
