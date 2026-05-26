import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

export interface NotificationPrefs {
    notif_general?: boolean
    notif_reminders?: boolean
    notif_summary?: boolean
}

export function UseMutateNotificationPrefs() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, unknown, NotificationPrefs>({
        mutationFn: async (prefs) => {
            const response = await authedFetch('/api/v1/me/notification-prefs', {
                method: 'PUT',
                body: JSON.stringify(prefs),
            })
            if (!response.ok) {
                throw new Error('Kunne ikke lagre preferansene')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-me'] }).then()
        },
    })
}
