import { useMutation } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'

// Sender en ny tilbakemelding. Ingen invalidation — vanlige brukere har ingen
// liste som må oppdateres.
export function UseSendTilbakemelding() {
    const authedFetch = useAuthedFetch()

    return useMutation<unknown, unknown, string>({
        mutationFn: async (message) => {
            const response = await authedFetch('/api/v1/feedback', {
                method: 'POST',
                body: JSON.stringify({ message }),
            })
            if (!response.ok) {
                throw new Error('Kunne ikke sende tilbakemeldingen')
            }
            return response.json()
        },
    })
}
