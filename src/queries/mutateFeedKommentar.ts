import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { FEED_QUERY_KEY, FeedKommentar, FeedRespons } from './useFeed'

// Oppretter en kommentar på en post. Optimistisk: legger inn en midlertidig
// kommentar med avsenderens navn/bilde mens forespørselen er underveis.
export function UseMutateFeedKommentar() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<
        FeedKommentar,
        Error,
        { postId: string; body: string; meNavn: string; mePicture: string | null },
        { forrige?: FeedRespons; tempId: string }
    >({
        mutationFn: async ({ postId, body }) => {
            const response = await authedFetch(`/api/v1/feed/${postId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ body }),
            })
            if (!response.ok) {
                const feil = await response.json().catch(() => ({}))
                throw new Error(feil.error || 'Kunne ikke lagre kommentar')
            }
            return response.json()
        },
        onMutate: async ({ postId, body, meNavn, mePicture }) => {
            await queryClient.cancelQueries({ queryKey: FEED_QUERY_KEY })
            const forrige = queryClient.getQueryData<FeedRespons>(FEED_QUERY_KEY)
            const tempId = `temp-${Date.now()}`
            const optimistisk: FeedKommentar = {
                id: tempId,
                navn: meNavn,
                picture: mePicture,
                body,
                created_at: new Date().toISOString(),
                reactions: [],
            }
            queryClient.setQueryData<FeedRespons>(FEED_QUERY_KEY, (gammel) => {
                if (!gammel) return gammel
                return {
                    posts: gammel.posts.map((p) =>
                        p.id === postId
                            ? {
                                  ...p,
                                  kommentarer: [...p.kommentarer, optimistisk],
                                  kommentarAntall: p.kommentarAntall + 1,
                              }
                            : p,
                    ),
                }
            })
            return { forrige, tempId }
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.forrige) queryClient.setQueryData(FEED_QUERY_KEY, ctx.forrige)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY })
        },
    })
}
