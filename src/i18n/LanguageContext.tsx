import React, { createContext, useContext, useEffect, useState } from 'react'
import no, { Translations } from './no'
import fr from './fr'
import { UseUser } from '../queries/useUser'
import { UseMutateLanguage } from '../queries/mutateLanguage'

export type Locale = 'no' | 'fr'

const LS_KEY = 'betpool:language'

const messages: Record<Locale, Translations> = { no, fr }

interface LanguageContextValue {
    locale: Locale
    setLocale: (l: Locale) => void
    t: Translations
}

const LanguageContext = createContext<LanguageContextValue>({
    locale: 'no',
    setLocale: () => {},
    t: no,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('no')
    const { data: me } = UseUser()
    const mutation = UseMutateLanguage()

    // Hydrate from DB (wins over localStorage) once user data is available
    useEffect(() => {
        if (me?.language === 'fr' || me?.language === 'no') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLocaleState(me.language)
            localStorage.setItem(LS_KEY, me.language)
        }
    }, [me?.language])

    // On first mount, read localStorage as fast initial value (before DB resolves)
    useEffect(() => {
        const cached = localStorage.getItem(LS_KEY)
        if ((cached === 'no' || cached === 'fr') && !me) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLocaleState(cached)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Update <html lang="..."> when locale changes
    useEffect(() => {
        document.documentElement.lang = locale
    }, [locale])

    const setLocale = (l: Locale) => {
        setLocaleState(l)
        localStorage.setItem(LS_KEY, l)
        mutation.mutate(l)
    }

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t: messages[locale] }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    return useContext(LanguageContext)
}
