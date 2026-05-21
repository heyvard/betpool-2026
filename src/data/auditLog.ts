import { PoolClient } from 'pg'

// Append-only revisjonslogg. Skriv én rad per endring på et bet, et resultat
// eller et bruker-flagg. Tabellen oppdateres aldri — den er kun til for å
// ettergå historikken hvis noen klager.
//
// Logging er «best effort»: en feil her skal aldri velte selve operasjonen
// brukeren ba om. Vi logger til console og går videre.

export type AuditEntitet = 'bet' | 'match_score' | 'user'

export interface AuditEndring {
    /** Hvem som utførte endringen (users.id). For et bet er det brukeren selv,
     *  for resultater/bruker-flagg er det en admin. */
    actorUserId: string
    entitet: AuditEntitet
    /** Naturlig nøkkel til entiteten. Bet: «<user_id>:<match_num>»,
     *  match_score: «<match_num>», user: «<user_id>». */
    entitetNøkkel: string
    handling: string
    før: unknown
    etter: unknown
}

export async function loggEndring(client: PoolClient, endring: AuditEndring): Promise<void> {
    try {
        await client.query(
            `INSERT INTO audit_log (actor_user_id, entity, entity_key, action, old_value, new_value)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                endring.actorUserId,
                endring.entitet,
                endring.entitetNøkkel,
                endring.handling,
                endring.før == null ? null : JSON.stringify(endring.før),
                endring.etter == null ? null : JSON.stringify(endring.etter),
            ],
        )
    } catch (e) {
        console.error('Klarte ikke skrive audit-logg', endring.entitet, endring.handling, e)
    }
}
