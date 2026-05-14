import type { AppProps } from 'next/app'
import React, { FC, useState } from 'react'
import { UseUser } from '../queries/useUser'
import { useRouter } from 'next/router'
import Head from 'next/head'

import '../styles/global.css'
import { getFirebaseAuth } from '../auth/clientApp'
import { useSession } from '../auth/useSession'
import { clearTestUser } from '../auth/testUserCookie'
import { erTestAuth } from '../utils/erTestAuth'
import { TestUserSwitcher } from '../components/dev/TestUserSwitcher'
import { TestClock } from '../components/dev/TestClock'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Banknote, House, ListOrdered, Menu, Pilcrow } from 'lucide-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SignInScreen } from '../components/SignIn'
import { LoadingScreen } from '../components/loading/LoadingScreen'
import { cn } from '@/lib/utils'

function logUt() {
    if (erTestAuth()) {
        clearTestUser()
        window.location.reload()
    } else {
        getFirebaseAuth().signOut()
    }
}

function Layout({ children }: { children: React.ReactNode }) {
    const { user, loading, error } = useSession()
    const { data: me } = UseUser()
    const router = useRouter()

    return (
        <>
            {erTestAuth() && <TestUserSwitcher />}
            {erTestAuth() && <TestClock />}
            <div className="px-2 pt-4 pb-16 mx-auto max-w-full sm:max-w-lg md:max-w-2xl">
                {error && <p className="text-red-500 text-sm">Error useAuthState: {JSON.stringify(error)}</p>}
                {loading && <LoadingScreen />}
                {!loading && !user && !erTestAuth() && <SignInScreen />}
                {!loading && !user && erTestAuth() && (
                    <p className="mt-8 text-center text-zinc-600">Velg en test-bruker nederst til høyre.</p>
                )}
                {user && <>{children}</>}
            </div>

            <nav className="fixed bottom-0 left-0 z-50 w-full h-16 flex bg-zinc-800 text-white shadow-lg">
                <NavKnapp url="/" icon={<House className="w-6 h-6" />} />
                <NavKnapp url="/my-bets" text="Kamper" icon={<Banknote className="w-6 h-6" />} />
                <NavKnapp url="/leaderboard" text="Resultater" icon={<ListOrdered className="w-6 h-6" />} />
                <NavKnapp url="/rules" text="Regler" icon={<Pilcrow className="w-6 h-6" />} />

                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button className="flex flex-col items-center justify-center w-full hover:bg-zinc-700 transition-colors">
                            <Menu className="w-6 h-6" />
                        </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            side="top"
                            align="end"
                            className="z-50 mb-2 mr-2 min-w-44 rounded-xl bg-white shadow-xl border border-zinc-200 py-1 text-sm"
                        >
                            <DropdownMenu.Item
                                className="px-4 py-2 cursor-pointer hover:bg-zinc-50 outline-none font-medium"
                                onSelect={() => router.push('/')}
                            >
                                {user?.displayName}
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className="px-4 py-2 cursor-pointer hover:bg-zinc-50 outline-none"
                                onSelect={() => router.push('/rules')}
                            >
                                Regler
                            </DropdownMenu.Item>
                            {me?.scoreadmin && (
                                <>
                                    <DropdownMenu.Item
                                        className="px-4 py-2 cursor-pointer hover:bg-zinc-50 outline-none"
                                        onSelect={() => router.push('/sluttspill')}
                                    >
                                        Rediger sluttspill
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        className="px-4 py-2 cursor-pointer hover:bg-zinc-50 outline-none"
                                        onSelect={() => router.push('/resultatservice')}
                                    >
                                        Rediger resultater
                                    </DropdownMenu.Item>
                                </>
                            )}
                            {(me?.superadmin || me?.paymentadmin) && (
                                <DropdownMenu.Item
                                    className="px-4 py-2 cursor-pointer hover:bg-zinc-50 outline-none"
                                    onSelect={() => router.push('/brukere')}
                                >
                                    Brukere
                                </DropdownMenu.Item>
                            )}
                            <DropdownMenu.Separator className="my-1 h-px bg-zinc-200" />
                            <DropdownMenu.Item
                                className="px-4 py-2 cursor-pointer hover:bg-zinc-50 outline-none text-red-600"
                                onSelect={logUt}
                            >
                                Logout
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            </nav>
        </>
    )
}

function MyApp({ Component, pageProps }: AppProps) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        refetchOnMount: false,
                        refetchOnWindowFocus: false,
                    },
                },
            }),
    )

    return (
        <>
            <Head>
                <title>Betpool 2024</title>
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <link rel="apple-touch-icon" href="/favicon-180x180.png" />
                <link rel="manifest" href="/manifest.json" />
            </Head>
            <QueryClientProvider client={queryClient}>
                <Layout>
                    <Component {...pageProps} />
                </Layout>
            </QueryClientProvider>
        </>
    )
}

const NavKnapp: FC<{ icon: React.ReactNode; text?: string; url: string }> = ({ icon, text, url }) => {
    const router = useRouter()
    const isActive = router.pathname === url
    return (
        <button
            type="button"
            onClick={() => router.push(url)}
            className={cn(
                'flex flex-col items-center justify-center w-full gap-0.5 transition-colors',
                isActive ? 'bg-zinc-600 text-white' : 'hover:bg-zinc-700',
            )}
        >
            {icon}
            {text && <span className="text-xs">{text}</span>}
        </button>
    )
}

export default MyApp
