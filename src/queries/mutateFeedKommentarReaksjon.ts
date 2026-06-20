import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { FEED_QUERY_KEY, FeedRespons, toggleReaksjon } from './useFeed'

// Toggler en emoji-reaksjon på en kommentar, med optimistisk oppdatering.
export function UseMutateFeedKommentarReaksjon() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<void, Error, { postId: string; commentId: string; emoji: string }, { forrige?: FeedRespons }>({
        mutationFn: async ({ commentId, emoji }) => {
            const response = await authedFetch(`/api/v1/feed/comments/${commentId}/reactions`, {
                method: 'POST',
                body: JSON.stringify({ emoji }),
            })
            if (!response.ok) throw new Error('Kunne ikke reagere')
        },
        onMutate: async ({ postId, commentId, emoji }) => {
            await queryClient.cancelQueries({ queryKey: FEED_QUERY_KEY })
            const forrige = queryClient.getQueryData<FeedRespons>(FEED_QUERY_KEY)
            queryClient.setQueryData<FeedRespons>(FEED_QUERY_KEY, (gammel) => {
                if (!gammel) return gammel
                return {
                    posts: gammel.posts.map((p) =>
                        p.id !== postId
                            ? p
                            : {
                                  ...p,
                                  kommentarer: p.kommentarer.map((k) =>
                                      k.id === commentId ? { ...k, reactions: toggleReaksjon(k.reactions, emoji) } : k,
                                  ),
                              },
                    ),
                }
            })
            return { forrige }
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.forrige) queryClient.setQueryData(FEED_QUERY_KEY, ctx.forrige)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY })
        },
    })
}
