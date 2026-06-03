/** @type {import('next').NextConfig} */

// Firebase Auth sin standard authDomain (PROSJEKT.firebaseapp.com) er et annet origin
// enn app-domenet. Da blokkerer Safari (ITP) lagringen som signInWithRedirect trenger,
// og brukeren blir ikke logget inn etter redirecten tilbake. Løsningen er å self-hoste
// auth-handleren: appen bruker app-domenet som authDomain (utledes automatisk fra
// window.location i src/auth/clientApp.ts) og proxyer /__/auth/** hit til firebaseapp.com.
// Da blir hele flyten same-origin og fungerer i Safari uten popup/fane-trøbbel.
// Husk å legge app-domenet i Firebase → Authentication → Authorized domains, og
// https://APP-DOMENE/__/auth/handler i OAuth-klientens Authorized redirect URIs.
// Se https://firebase.google.com/docs/auth/web/redirect-best-practices
const firebaseAuthHost = `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'betpool-2026'}.firebaseapp.com`

const nextConfig = {
    reactStrictMode: true,
    experimental: {
        optimizePackageImports: ['lucide-react', '@radix-ui/react-dropdown-menu', '@radix-ui/react-switch'],
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
            },
        ],
    },
    async rewrites() {
        return [
            { source: '/__/auth/:path*', destination: `${firebaseAuthHost}/__/auth/:path*` },
            { source: '/__/firebase/:path*', destination: `${firebaseAuthHost}/__/firebase/:path*` },
        ]
    },
}

module.exports = nextConfig
