import { FeedPost } from '../../queries/useFeed'

// Aksent-kart — fargene fra designsystemet, indeksert på postens aksenttype.
// `acc` = fargebånd/aksent, `accbg` = svak bakgrunn, `acctx` = tekstfarge.
export const ACCENT: Record<FeedPost['accent'], { acc: string; accbg: string; acctx: string }> = {
    win: { acc: '#16a34a', accbg: '#dcfce7', acctx: '#15803d' },
    live: { acc: '#dc2626', accbg: '#fee2e2', acctx: '#b91c1c' },
    gold: { acc: '#f59e0b', accbg: '#fef3c7', acctx: '#b45309' },
    stone: { acc: '#a8a29e', accbg: '#f5f5f4', acctx: '#57534e' },
    royal: { acc: '#1e40af', accbg: '#dbeafe', acctx: '#1e40af' },
}

function toTo(n: number): string {
    return n < 10 ? `0${n}` : String(n)
}

// Visningsnavn: kutt en evt. e-post på «@» (samme mønster som ledertavla).
export function visningsnavn(navn: string): string {
    return navn.includes('@') ? navn.split('@')[0] : navn
}

// «i dag · 08:00» / «i går · 21:02» / «18.06 · 21:02». Tidssone er nettleserens
// (brukerne er i norsk tid).
export function tidEtikett(iso: string): string {
    const d = new Date(iso)
    const nå = new Date()
    const klokke = `${toTo(d.getHours())}:${toTo(d.getMinutes())}`
    const sammeDag = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
    const iGår = new Date(nå)
    iGår.setDate(nå.getDate() - 1)
    if (sammeDag(d, nå)) return `i dag · ${klokke}`
    if (sammeDag(d, iGår)) return `i går · ${klokke}`
    return `${toTo(d.getDate())}.${toTo(d.getMonth() + 1)} · ${klokke}`
}

// Kort relativ tid for kommentarer: «nå», «5 min», «2 t», «3 d».
export function relativKort(iso: string): string {
    const sek = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
    if (sek < 60) return 'nå'
    const min = Math.floor(sek / 60)
    if (min < 60) return `${min} min`
    const t = Math.floor(min / 60)
    if (t < 24) return `${t} t`
    const d = Math.floor(t / 24)
    return `${d} d`
}
