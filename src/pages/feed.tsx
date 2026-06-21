import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Bell } from 'lucide-react'

import { Spinner } from '../components/loading/Spinner'
import { UseFeed } from '../queries/useFeed'
import { UseUser } from '../queries/useUser'
import { useLanguage } from '../i18n/LanguageContext'
import { FeedKort } from '../components/feed/FeedKort'
import { BetpoolLogo } from '../components/feed/FeedBits'
import { visningsnavn } from '../components/feed/feedUtils'

const Feed: NextPage = () => {
    const { t } = useLanguage()
    const { data, isLoading } = UseFeed()
    const { data: me } = UseUser()
    const router = useRouter()

    const meNavn = visningsnavn(me?.kallenavn?.trim() || me?.name || '')
    const mePicture = me?.picture ?? null

    if (!me) return <Spinner />

    return (
        // -mx-2 opphever layoutens px-2 så kortene flyter på den grå flaten edge-to-edge
        <div className="-mx-2 min-h-screen" style={{ background: '#f5f5f4' }}>
            {/* Header */}
            <div
                className="flex items-center justify-between bg-white"
                style={{ padding: '18px 18px 12px', borderBottom: '1px solid #e7e5e4' }}
            >
                <div>
                    <p style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', color: '#1c1917' }}>
                        {t.feed.tittel}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => router.push('/varsler')}
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 34, height: 34, background: '#f5f5f4' }}
                    aria-label={t.nav.varsler}
                >
                    <Bell size={17} style={{ color: '#57534e' }} />
                </button>
            </div>

            {isLoading ? (
                <Spinner />
            ) : !data || data.posts.length === 0 ? (
                <TomTilstand />
            ) : (
                <div style={{ paddingTop: 12 }}>
                    {data.posts.map((post) => (
                        <FeedKort
                            key={post.id}
                            post={post}
                            meNavn={meNavn}
                            mePicture={mePicture}
                            erSuperadmin={!!me.superadmin}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function TomTilstand() {
    const { t } = useLanguage()
    return (
        <div className="flex flex-col items-center justify-center px-8 text-center" style={{ paddingTop: 80 }}>
            <div style={{ opacity: 0.5 }}>
                <BetpoolLogo size={48} />
            </div>
            <p className="mt-4" style={{ fontSize: 16, fontWeight: 800, color: '#1c1917' }}>
                {t.feed.ingenHendelser}
            </p>
            <p className="mt-1" style={{ fontSize: 13, color: '#78716c', maxWidth: 260 }}>
                {t.feed.ingenHendelserSub}
            </p>
        </div>
    )
}

export default Feed
