import type { NextPage } from 'next'
import { Html, Head, Main, NextScript } from 'next/document'

const Home: NextPage = () => {
    return (
        <Html lang={'no'}>
            <Head></Head>
            <body className={'bg-stone-50 text-stone-900 antialiased'}>
                <Main />
                <NextScript />
            </body>
        </Html>
    )
}

export default Home
