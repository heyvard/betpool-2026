import { useMutation } from '@tanstack/react-query'
import { useAuthedFetch } from '../auth/authedFetch'

export interface SendPushPayload {
    userId: string
    title: string
    body: string
    url?: string
}

export interface SendPushResultat {
    sendt: number
}

export function UseSendPush() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async (payload: SendPushPayload) => {
            const response = await authedFetch('/api/v1/admin/send-push', {
                method: 'POST',
                body: JSON.stringify(payload),
            })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<SendPushResultat>
        },
    })
}

export interface SendPushAllePayload {
    title: string
    body: string
    url?: string
}

export interface SendPushAlleResultat {
    brukere: number
    enheter: number
}

export function UseSendPushAlle() {
    const authedFetch = useAuthedFetch()
    return useMutation({
        mutationFn: async (payload: SendPushAllePayload) => {
            const response = await authedFetch('/api/v1/admin/send-push-alle', {
                method: 'POST',
                body: JSON.stringify(payload),
            })
            if (!response.ok) throw new Error(`Serverfeil: ${response.status}`)
            return response.json() as Promise<SendPushAlleResultat>
        },
    })
}
