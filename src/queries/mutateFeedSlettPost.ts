import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { FEED_QUERY_KEY, FeedRespons } from './useFeed'

// Sletter en hel feed-post (kun superadmin på serversiden). Optimistisk: fjerner
// posten fra feeden umiddelbart og ruller tilbake ved feil.
export function UseMutateFeedSlettPost() {
    const queryClient = useQueryClient()
    const authedFetch = useAuthedFetch()

    return useMutation<void, Error, { postId: string }, { forrige?: FeedRespons }>({
        mutationFn: async ({ postId }) => {
            const response = await authedFetch(`/api/v1/feed/${postId}`, { method: 'DELETE' })
            if (!response.ok) throw new Error('Kunne ikke slette posten')
        },
        onMutate: async ({ postId }) => {
            await queryClient.cancelQueries({ queryKey: FEED_QUERY_KEY })
            const forrige = queryClient.getQueryData<FeedRespons>(FEED_QUERY_KEY)
            queryClient.setQueryData<FeedRespons>(FEED_QUERY_KEY, (gammel) => {
                if (!gammel) return gammel
                return { posts: gammel.posts.filter((p) => p.id !== postId) }
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
