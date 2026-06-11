import { PoolClient } from 'pg'

import { sendPushTilBruker, PushPayload } from './push'

export interface VmStartResultat {
    brukereVarslet: number
}

export interface VmStartDryRunBruker {
    id: string
    name: string
    email: string
    language: string
}

export interface VmStartDryRunResultat {
    brukereVilBliVarslet: VmStartDryRunBruker[]
}

const PAYLOAD: Record<string, PushPayload> = {
    no: {
        title: 'VM starter i dag! ⚽🏆',
        body: 'I dag sparkes VM i gang! Siste sjanse til å invitere noen til å bli med.',
        url: '/',
    },
    fr: {
        title: "Le Mondial commence aujourd'hui ! ⚽🏆",
        body: "La Coupe du Monde débute aujourd'hui ! Dernière chance d'inviter quelqu'un à rejoindre.",
        url: '/',
    },
}

function velgPayload(language: string): PushPayload {
    return PAYLOAD[language] ?? PAYLOAD.no
}

export async function sendVmStartVarsel(client: PoolClient): Promise<VmStartResultat> {
    console.log('[send-vm-start] starter')

    const brukere = (
        await client.query<{ id: string; language: string }>(
            `SELECT id, COALESCE(language, 'no') AS language FROM users WHERE active = true AND notif_general = true`,
        )
    ).rows

    console.log(`[send-vm-start] ${brukere.length} aktive brukere med generelle varsler på`)

    let brukereVarslet = 0
    for (const bruker of brukere) {
        const sendt = await sendPushTilBruker(client, bruker.id, velgPayload(bruker.language))
        if (sendt > 0) {
            brukereVarslet++
            console.log(`[send-vm-start] varslet bruker ${bruker.id} (${bruker.language})`)
        }
    }

    const resultat = { brukereVarslet }
    console.log('[send-vm-start] ferdig —', resultat)
    return resultat
}

export async function dryRunVmStartVarsel(client: PoolClient): Promise<VmStartDryRunResultat> {
    console.log('[send-vm-start] dry run starter')

    const brukere = (
        await client.query<{ id: string; name: string; email: string; language: string }>(
            `SELECT id, name, email, COALESCE(language, 'no') AS language FROM users WHERE active = true AND notif_general = true`,
        )
    ).rows

    console.log(`[send-vm-start] dry run: ${brukere.length} aktive brukere med generelle varsler på`)

    return { brukereVilBliVarslet: brukere }
}
