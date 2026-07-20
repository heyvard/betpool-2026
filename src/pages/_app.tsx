import type { AppProps } from 'next/app'
import React, { FC, useEffect, useState } from 'react'
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
import { BarChart3, Check, ChevronRight, House, ListOrdered, Menu, Radio, Settings, Trophy, Zap } from 'lucide-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoadingScreen } from '../components/loading/LoadingScreen'
import { PullToRefresh } from '../components/PullToRefresh'
import { VarslerPrompt } from '../components/VarslerPrompt'
import { VmSluttPopup } from '../components/VmSluttPopup'
import { Onboarding } from '../components/Onboarding'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { LanguageProvider, useLanguage } from '../i18n/LanguageContext'
import { fjernPendingInvite, inviteTokenFraSti, lagrePendingInvite, lesPendingInvite } from '../utils/pendingInvite'

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

    // Husk en invitasjonslenke en uinnlogget bruker åpner — bli-med-siden mountes
    // ikke før man er innlogget, så vi fanger token-en her i Layout.
    useEffect(() => {
        if (user) return
        const token = inviteTokenFraSti(router.asPath)
        if (token) lagrePendingInvite(token)
    }, [user, router.asPath])

    // Når brukeren er innlogget og ferdig onboardet, send dem til den huskede
    // invitasjonen (med mindre vi allerede er på en bli-med-side).
    useEffect(() => {
        if (!user || !me || me.onboarded_at == null) return
        if (router.asPath.startsWith('/bli-med/')) return
        const token = lesPendingInvite()
        if (!token) return
        fjernPendingInvite()
        router.replace('/bli-med/' + token)
    }, [user, me, router])

    return (
        <>
            {erTestAuth() && <TestUserSwitcher />}
            {erTestAuth() && <TestClock />}
            <div className="px-2 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] mx-auto max-w-full sm:max-w-lg md:max-w-2xl">
                {error && <p className="text-red-500 text-sm">Error useAuthState: {JSON.stringify(error)}</p>}
                {loading && <LoadingScreen />}
                {!loading && !user && !erTestAuth() && <SignInScreen />}
                {!loading && !user && erTestAuth() && (
                    <p className="mt-8 text-center text-stone-600">{t.testBruker.velg}</p>
                )}
                {user &&
                    // Sluttspill-bracketen ruller både vannrett og loddrett. «Dra ned for å
                    // oppdatere» kapret de gestene (man fikk ikke scrollet helt ned, og draget
                    // trigget en uønsket refresh), så den er slått av her.
                    (router.pathname === '/bracket' ? children : <PullToRefresh>{children}</PullToRefresh>)}
                {user && <VarslerPrompt />}
                {user && !trengerOnboarding && <VmSluttPopup />}
            </div>
            {user && trengerOnboarding && (
                <Onboarding onFerdig={() => queryClient.invalidateQueries({ queryKey: ['user-me'] })} />
            )}

            {/* iOS Safari maler ikke `position: fixed`-elementer på nytt under
                treghetsscroll – baren «løsner» og flyter opp i innholdet. Å løfte
                den til et eget GPU-lag (translateZ/will-change) holder den pinnet.
                `min-h-16` + safe-area-padding holder den klar av home-indikatoren. */}
            <nav className="fixed bottom-0 left-0 z-50 w-full min-h-[calc(4rem+env(safe-area-inset-bottom))] flex bg-stone-900 text-stone-300 border-t border-stone-800 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)] [transform:translateZ(0)] [-webkit-backface-visibility:hidden] [backface-visibility:hidden] [will-change:transform]">
                <NavKnapp url="/" text={t.nav.hjem} icon={<House className="w-5 h-5" />} />
                <NavKnapp url="/leaderboard" text={t.nav.resultater} icon={<ListOrdered className="w-5 h-5" />} />
                <NavKnapp url="/feed" text={t.nav.feed} icon={<Radio className="w-5 h-5" />} />

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
                                onSelect={() => router.push('/grupper')}
                            >
                                {t.nav.grupper}
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                onSelect={() => router.push('/bracket')}
                            >
                                <div className="flex items-center gap-2">
                                    <Trophy className="h-4 w-4 text-amber-500" />
                                    <span>{t.nav.sluttspill}</span>
                                </div>
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
                            <DropdownMenu.Item
                                className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                onSelect={() => router.push('/innstillinger')}
                            >
                                {t.nav.innstillinger}
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                onSelect={() => router.push('/tilbakemelding')}
                            >
                                {t.nav.tilbakemelding}
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className="px-4 py-2 cursor-pointer hover:bg-amber-50 hover:text-amber-900 outline-hidden"
                                onSelect={() => router.push('/jokerbruk')}
                            >
                                <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-amber-500" />
                                    <span className="font-semibold text-stone-900">{t.nav.jokerbruk}</span>
                                </div>
                            </DropdownMenu.Item>
                            <DropdownMenu.Sub>
                                <DropdownMenu.SubTrigger className="flex items-center justify-between w-full px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700 data-[state=open]:bg-stone-50">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-stone-400" />
                                        <span>{t.nav.statistikk}</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-stone-400" />
                                </DropdownMenu.SubTrigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.SubContent
                                        sideOffset={4}
                                        className="z-50 min-w-44 rounded-xl bg-white shadow-xl ring-1 ring-stone-200 py-1.5 text-sm"
                                    >
                                        <DropdownMenu.Item
                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                            onSelect={() => router.push('/statistikk-beste-tips')}
                                        >
                                            {t.nav.besteTips}
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                            onSelect={() => router.push('/statistikk-verdifulle-kamper')}
                                        >
                                            {t.nav.verdifulleKamper}
                                        </DropdownMenu.Item>
                                    </DropdownMenu.SubContent>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Sub>
                            {(me?.scoreadmin || me?.superadmin || me?.paymentadmin) && (
                                <>
                                    <DropdownMenu.Separator className="my-1 h-px bg-stone-200" />
                                    <DropdownMenu.Sub>
                                        <DropdownMenu.SubTrigger className="flex items-center justify-between w-full px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700 data-[state=open]:bg-stone-50">
                                            <div className="flex items-center gap-2">
                                                <Settings className="h-4 w-4 text-stone-400" />
                                                <span>{t.nav.admin}</span>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-stone-400" />
                                        </DropdownMenu.SubTrigger>
                                        <DropdownMenu.Portal>
                                            <DropdownMenu.SubContent
                                                sideOffset={4}
                                                className="z-50 min-w-44 rounded-xl bg-white shadow-xl ring-1 ring-stone-200 py-1.5 text-sm"
                                            >
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
                                                    <>
                                                        <DropdownMenu.Item
                                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                                            onSelect={() => router.push('/brukere')}
                                                        >
                                                            {t.nav.brukere}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item
                                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                                            onSelect={() => router.push('/send-push')}
                                                        >
                                                            {t.nav.sendPush}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item
                                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                                            onSelect={() => router.push('/admin-ligaer')}
                                                        >
                                                            {t.nav.adminLigaer}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item
                                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                                            onSelect={() => router.push('/cron')}
                                                        >
                                                            {t.nav.cron}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item
                                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                                            onSelect={() => router.push('/spillere')}
                                                        >
                                                            {t.nav.spillere}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item
                                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                                            onSelect={() => router.push('/toppscorer-fiks')}
                                                        >
                                                            {t.nav.toppscorerFiks}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item
                                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                                            onSelect={() => router.push('/vinner-toppscorer')}
                                                        >
                                                            {t.nav.vinnerToppscorer}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item
                                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                                            onSelect={() => router.push('/manglende-tips')}
                                                        >
                                                            {t.nav.manglendeTips}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item
                                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                                            onSelect={() => router.push('/standings-debug')}
                                                        >
                                                            {t.nav.standingsDebug}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item
                                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                                            onSelect={() => router.push('/admin-match-data')}
                                                        >
                                                            {t.nav.kampApiData}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item
                                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                                            onSelect={() => router.push('/debug-data')}
                                                        >
                                                            {t.nav.debugData}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item
                                                            className="px-4 py-2 cursor-pointer hover:bg-stone-50 outline-hidden text-stone-700"
                                                            onSelect={() => router.push('/tilbakemeldinger')}
                                                        >
                                                            {t.nav.tilbakemeldinger}
                                                        </DropdownMenu.Item>
                                                    </>
                                                )}
                                            </DropdownMenu.SubContent>
                                        </DropdownMenu.Portal>
                                    </DropdownMenu.Sub>
                                </>
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
                {/* viewport-fit=cover trengs for at env(safe-area-inset-*) skal gi
                    faktiske verdier på iPhone (ellers er de alltid 0). */}
                <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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
