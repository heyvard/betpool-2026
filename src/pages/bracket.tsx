import type { NextPage } from 'next'
import React from 'react'

import { Spinner } from '../components/loading/Spinner'
import { UseMatches } from '../queries/useMatches'
import { Bracket } from '../components/bracket/Bracket'
import { Heading } from '@/components/ui/typography'
import { useLanguage } from '../i18n/LanguageContext'

const BracketPage: NextPage = () => {
    const { data: matches } = UseMatches()
    const { t } = useLanguage()

    if (!matches) {
        return <Spinner />
    }

    return (
        <>
            <Heading size="medium" align="center">
                {t.nav.sluttspill}
            </Heading>
            <Bracket matches={matches} />
        </>
    )
}

export default BracketPage
