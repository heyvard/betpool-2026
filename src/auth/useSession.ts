import { useEffect, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'

import { erTestAuth } from '../utils/erTestAuth'

import { getFirebaseAuth } from './clientApp'
import { readTestUser } from './testUserCookie'

export interface SessionUser {
    uid: string
    displayName: string | null
    getIdToken: () => Promise<string>
}

export interface Session {
    user: SessionUser | undefined
    loading: boolean
    error: Error | undefined
}

function useFirebaseSession(): Session {
    const [user, loading, error] = useAuthState(getFirebaseAuth())
    return {
        user: user ? { uid: user.uid, displayName: user.displayName, getIdToken: () => user.getIdToken() } : undefined,
        loading,
        error,
    }
}

function useTestSession(): Session {
    // Leser test-bruker-cookien etter mount for å unngå hydration-mismatch.
    const [testUser, setTestUserState] = useState<string | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTestUserState(readTestUser())
        setLoading(false)
    }, [])
    return {
        user: testUser ? { uid: testUser, displayName: testUser, getIdToken: async () => 'test-auth' } : undefined,
        loading,
        error: undefined,
    }
}

// Valget er fast ved modul-evaluering — env-flagget endres aldri i runtime,
// så hver implementasjon kaller hooks ubetinget.
export const useSession: () => Session = erTestAuth() ? useTestSession : useFirebaseSession
