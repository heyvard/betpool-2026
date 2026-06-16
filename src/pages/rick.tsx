import type { GetServerSideProps } from 'next'

// /rick er bare en redirect til Rick Astley på YouTube.
export const getServerSideProps: GetServerSideProps = async () => {
    return {
        redirect: {
            destination: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            permanent: false,
        },
    }
}

export default function Rick() {
    return null
}
