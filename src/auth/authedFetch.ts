import { erTestAuth } from '../utils/erTestAuth'

import { useSession } from './useSession'

// Returnerer en fetch-funksjon som legger på autentisering.
// Normalmodus: «Authorization: Bearer <firebase-id-token>».
// Test-auth: ingen header — «betpool_test_user»-cookien bærer identiteten.
export function useAuthedFetch() {
    const { user } = useSession()

    return async (path: string, init?: RequestInit): Promise<Response> => {
        const headers = new Headers(init?.headers)
        if (!erTestAuth()) {
            const token = await user?.getIdToken()
            if (token) {
                headers.set('Authorization', `Bearer ${token}`)
            }
        }
        return fetch(path, { ...init, headers })
    }
}
