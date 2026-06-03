import { FirebaseApp, initializeApp } from 'firebase/app'
import 'firebase/firestore'
import { Auth, getAuth } from 'firebase/auth'

// Vi self-hoster Firebase Auth-handleren (se rewrites i next.config.js): /__/auth/**
// proxyes til PROSJEKT.firebaseapp.com, slik at hele OAuth-flyten blir same-origin med
// app-domenet. For at det skal funke MÅ authDomain være domenet appen faktisk kjører på
// (f.eks. vm.turix.no) — ikke PROSJEKT.firebaseapp.com. Ellers navigerer
// signInWithRedirect til et annet origin, og Safari (ITP) dropper sesjonen på vei tilbake
// (bruker kommer tilbake uten å være innlogget). Vi utleder derfor authDomain fra
// window.location i nettleseren, så det alltid stemmer med domenet (prod + preview),
// uavhengig av om NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN er satt riktig. På localhost (dev) og
// på server faller vi tilbake til env-varen.
function authDomain(): string | undefined {
    if (typeof window !== 'undefined') {
        const host = window.location.hostname
        if (host !== 'localhost' && host !== '127.0.0.1') {
            return host
        }
    }
    return process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
}

const clientCredentials = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: authDomain(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let auth: Auth | undefined = undefined
let app: FirebaseApp | undefined = undefined

export function getFirebaseApp() {
    if (!app) {
        app = initializeApp(clientCredentials)
    }
    return app
}

export function getFirebaseAuth() {
    if (!auth) {
        auth = getAuth(getFirebaseApp())
    }
    return auth
}
