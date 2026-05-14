import { Skeleton } from '@/components/ui/skeleton'

export const Spinner = () => {
    return (
        <>
            <Skeleton className="w-full p-4 h-80 mb-1" />
            <Skeleton className="w-full p-4 h-80 mb-1" />
        </>
    )
}
