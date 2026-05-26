import React from 'react'

export const BpCard = ({
    children,
    bg,
    testId,
}: {
    children: React.ReactNode | React.ReactNode[]
    bg?: string
    testId?: string
}) => {
    const background = bg ? bg : 'bg-white'
    return (
        <div data-testid={testId} className={`${background} my-4 p-4 shadow-xs ring-1 ring-stone-200/70 rounded-xl`}>
            {children}
        </div>
    )
}
