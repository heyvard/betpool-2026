import React from 'react'
import { EmailAuthProvider, GoogleAuthProvider } from 'firebase/auth'
import StyledFirebaseAuth from '../auth/StyledFirebaseAuth'
import { BpCard } from './Card'
import { BodyShort, Heading } from '@/components/ui/typography'

const uiConfig = {
    signInSuccessUrl: '/',
    signInFlow: 'popup',
    signInOptions: [GoogleAuthProvider.PROVIDER_ID, EmailAuthProvider.PROVIDER_ID],
}

export function SignInScreen() {
    const isFacebookInAppBrowser =
        /FB_IAB/.test(navigator.userAgent) || /FBAN/.test(navigator.userAgent) || /FBAV/.test(navigator.userAgent)
    return (
        <>
            <BpCard>
                <Heading size="large" align="center">
                    VM Betpool
                </Heading>
            </BpCard>

            <BpCard>
                <BodyShort align="center">300 kr innskudd 💸</BodyShort>
            </BpCard>
            <BpCard>
                <BodyShort align="center">Bet frem til kampstart på hver kamp, på toppscorer og vinner ⚽</BodyShort>
            </BpCard>
            <BpCard>
                <BodyShort align="center">Hvem kan bli med? Hvem som helst som har denne lenken. 🤝</BodyShort>
            </BpCard>

            <BpCard>
                <BodyShort align="center">Bruk din vanlige browser på mobil.</BodyShort>
            </BpCard>
            {isFacebookInAppBrowser && (
                <BpCard>
                    <BodyShort align="center">
                        For å logge på må du åpne denne siden utenfor facebook messenger, i vanlig browser.
                    </BodyShort>
                </BpCard>
            )}
            {!isFacebookInAppBrowser && <StyledFirebaseAuth uiConfig={uiConfig} />}
        </>
    )
}
