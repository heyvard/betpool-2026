// Tillatte emoji-reaksjoner i feeden. Valideres server-side (API avviser resten)
// og brukes av emoji-velgeren på klienten. Delt konstant — ren data, trygt å
// importere fra både server og klient.
export const TILLATTE_EMOJI = ['🔥', '😂', '💀', '😱', '👏', '🎯'] as const

export type FeedEmoji = (typeof TILLATTE_EMOJI)[number]

export function erTillattEmoji(emoji: unknown): emoji is FeedEmoji {
    return typeof emoji === 'string' && (TILLATTE_EMOJI as readonly string[]).includes(emoji)
}
