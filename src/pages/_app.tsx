import type { AppProps } from 'next/app'
import React, { FC, useState } from 'react'
import { UseUser } from '../queries/useUser'
import { useRouter } from 'next/router'
import Head from 'next/head'
import dynamic from 'next/dynamic'

import '../styles/global.css'
import { getFirebaseAuth } from '../auth/clientApp'
import { useSession } from '../auth/useSession'
import { clearTestUser } from '../auth/testUserCookie'
import { erTestAuth } from '../utils/erTestAuth'
import { TestUserSwitcher } from '../components/dev/TestUserSwitcher'
import { TestClock } from '../components/dev/TestClock'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { BookOpen, Check, House, ListChecks, ListOrdered, Menu } from 'lucide-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoadingScreen } from '../components/loading/LoadingScreen'
import { PullToRefresh } from '../components/PullToRefresh'
import { VarslerPrompt } from '../components/VarslerPrompt'
import { Onboarding } from '../components/Onboarding'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { LanguageProvider, useLanguage } from '../i18n/LanguageContext'

// firebaseui er tungt og brukes bare i utlogga-tilstand — last det først når vi
// faktisk trenger det.
const SignInScreen = dynamic(() => import('../components/SignIn').then((m) => m.SignInScreen), {
    ssr: false,
    loading: () => <LoadingScreen />,
})

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
    const queryClient = useQueryClient()
    const trengerOnboarding = !!me && me.onboarded_at == null
    const { t, locale, setLocale } = useLanguage()

    return (
        <>
            {erTestAuth() && <TestUserSwitcher />}
            {erTestAuth() && <TestClock />}
            <div className="px-2 pt-4 pb-16 mx-auto max-w-full sm:max-w-lg md:max-w-2xl">
                {error && <p className="text-red-500 text-sm">Error useAuthState: {JSON.stringify(error)}</p>}
                {loading && <LoadingScreen />}
                {!loading && !user && !erTestAuth() && <SignInScreen />}
                {!loading && !user && erTestAuth() && (
                    <p className="mt-8 text-center text-stone-600">{t.testBruker.velg}</p>
                )}
                {user && <PullToRefresh>{children}</PullToRefresh>}
                {user && <VarslerPrompt />}
            </div>
            {user && trengerOnboarding && (
                <Onboarding onFerdig={() => queryClient.invalidateQueries({ queryKey: ['user-me'] })} />
            )}

            <nav className="fixed bottom-0 left-0 z-50 w-full h-16 flex bg-stone-900 text-stone-300 border-t border-stone-800 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
                <NavKnapp url="/" text={t.nav.hjem} icon={<House className="w-5 h-5" />} />
                <NavKnapp url="/my-bets" text={t.nav.tipp} icon={<ListChecks className="w-5 h-5" />} />
                <NavKnapp url="/leaderboard" text={t.nav.resultater} icon={<ListOrdered className="w-5 h-5" />} />
                <NavKnapp url="/rules" text={t.nav.regler} icon={<BookOpen className="w-5 h-5" />} />

                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button className="flex flex-col items-center justify-center w-full gap-0.5 text-stone-300 hover:text-white hover:bg-stone-800/60 active:bg-stone-800 transition-colors">
                            <Menu className="w-5 h-5" />
                            <span className="text-[10px] font-medium tracking-wide uppercase">{t.nav.meny}</span>
                        </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            side="top"
                            align="end"
                            sideOffset={8}
                            className="z-50 mr-2 min-w-48 rounded-xl bg-white shadow-xl ring-1 ring-stone-200 py-1.5 text-sm"
                        >
                            <DropdownMenu.Label className="px-4 py-2 text-xs font-medium text-stone-500">
                                {user?.displayName}
                            </DropdownMenu.Label>
                            <DropdownMenu.Separator className="my-1 h-px bg-stone-200" />
                            <DropdownMenu.Item
                                className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                onSelect={() => router.push('/rules')}
                            >
                                {t.nav.regler}
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                onSelect={() => router.push('/ligaer')}
                            >
                                {t.nav.ligaer}
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                onSelect={() => router.push('/varsler')}
                            >
                                {t.nav.varsler}
                            </DropdownMenu.Item>
                            {me?.scoreadmin && (
                                <>
                                    <DropdownMenu.Item
                                        className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                        onSelect={() => router.push('/sluttspill')}
                                    >
                                        {t.nav.redigerSluttspill}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                        onSelect={() => router.push('/resultatservice')}
                                    >
                                        {t.nav.redigerResultater}
                                    </DropdownMenu.Item>
                                </>
                            )}
                            {(me?.superadmin || me?.paymentadmin) && (
                                <DropdownMenu.Item
                                    className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                    onSelect={() => router.push('/innbetaling')}
                                >
                                    {t.nav.innbetaling}
                                </DropdownMenu.Item>
                            )}
                            {me?.superadmin && (
                                <DropdownMenu.Item
                                    className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                    onSelect={() => router.push('/brukere')}
                                >
                                    {t.nav.brukere}
                                </DropdownMenu.Item>
                            )}
                            <DropdownMenu.Separator className="my-1 h-px bg-stone-200" />
                            <DropdownMenu.Label className="px-4 py-1 text-xs font-medium text-stone-400">
                                {t.nav.sprak}
                            </DropdownMenu.Label>
                            <DropdownMenu.Item
                                className={cn(
                                    'flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden',
                                    locale === 'no' ? 'font-semibold text-stone-900' : 'text-stone-600',
                                )}
                                onSelect={() => setLocale('no')}
                            >
                                <span>🇳🇴 Norsk</span>
                                {locale === 'no' && <Check className="h-3.5 w-3.5 text-amber-600" />}
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className={cn(
                                    'flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden',
                                    locale === 'fr' ? 'font-semibold text-stone-900' : 'text-stone-600',
                                )}
                                onSelect={() => setLocale('fr')}
                            >
                                <span>🇫🇷 Français</span>
                                {locale === 'fr' && <Check className="h-3.5 w-3.5 text-amber-600" />}
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className="my-1 h-px bg-stone-200" />
                            <DropdownMenu.Item
                                className="px-4 py-2 cursor-pointer hover:bg-red-50 outline-hidden text-red-600 font-medium"
                                onSelect={logUt}
                            >
                                {t.nav.loggUt}
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
                <title>Betpool 2026</title>
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link rel="icon" type="image/x-icon" href="/favicon.ico" />
                <link rel="apple-touch-icon" href="/favicon-180x180.png" />
                <link rel="manifest" href="/manifest.json" />
            </Head>
            <QueryClientProvider client={queryClient}>
                <LanguageProvider>
                    <Layout>
                        <Component {...pageProps} />
                    </Layout>
                </LanguageProvider>
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
                'relative flex flex-col items-center justify-center w-full gap-0.5 transition-colors',
                isActive
                    ? 'text-amber-400'
                    : 'text-stone-300 hover:text-white hover:bg-stone-800/60 active:bg-stone-800',
            )}
        >
            {isActive && (
                <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-amber-400"
                />
            )}
            {icon}
            {text && <span className="text-[10px] font-medium tracking-wide uppercase">{text}</span>}
        </button>
    )
}

export default MyApp
