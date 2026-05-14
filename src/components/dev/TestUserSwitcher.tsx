import React, { useEffect, useState } from 'react'

import { readTestUser, setTestUser, clearTestUser } from '../../auth/testUserCookie'

interface TestUser {
    id: string
    name: string
    firebase_user_id: string
    superadmin: boolean
    scoreadmin: boolean
    paymentadmin: boolean
}

// Dev-only brukervelger. Rendres kun når NEXT_PUBLIC_TEST_AUTH=true.
// Setter «betpool_test_user»-cookien og laster siden på nytt.
export function TestUserSwitcher() {
    const [users, setUsers] = useState<TestUser[]>([])
    const [open, setOpen] = useState(false)
    const [current, setCurrent] = useState<string | undefined>(undefined)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrent(readTestUser())
        fetch('/api/v1/test-users')
            .then((r) => (r.ok ? r.json() : []))
            .then(setUsers)
            .catch(() => setUsers([]))
    }, [])

    function velg(firebaseUserId: string) {
        setTestUser(firebaseUserId)
        window.location.reload()
    }

    function loggUt() {
        clearTestUser()
        window.location.reload()
    }

    return (
        <div className="fixed bottom-20 right-2 z-[100] text-sm">
            {open && (
                <div className="mb-2 max-h-80 w-64 overflow-auto rounded-xl border border-amber-300 bg-white shadow-xl">
                    <div className="border-b border-zinc-200 px-3 py-2 font-semibold text-amber-700">Test-bruker</div>
                    {users.length === 0 && <div className="px-3 py-2 text-zinc-500">Ingen brukere i DB</div>}
                    {users.map((u) => (
                        <button
                            key={u.id}
                            onClick={() => velg(u.firebase_user_id)}
                            className={
                                'block w-full px-3 py-2 text-left hover:bg-amber-50 ' +
                                (u.firebase_user_id === current ? 'bg-amber-100 font-medium' : '')
                            }
                        >
                            {u.name}
                            {(u.superadmin || u.scoreadmin || u.paymentadmin) && (
                                <span className="ml-1 text-xs text-zinc-500">
                                    {[u.superadmin && 'super', u.scoreadmin && 'score', u.paymentadmin && 'payment']
                                        .filter(Boolean)
                                        .join(', ')}
                                </span>
                            )}
                        </button>
                    ))}
                    <button
                        onClick={loggUt}
                        className="block w-full border-t border-zinc-200 px-3 py-2 text-left text-red-600 hover:bg-red-50"
                    >
                        Logg ut
                    </button>
                </div>
            )}
            <button
                onClick={() => setOpen((o) => !o)}
                className="rounded-full bg-amber-400 px-3 py-2 font-semibold text-amber-950 shadow-lg"
            >
                {current ?? 'velg test-bruker'}
            </button>
        </div>
    )
}
