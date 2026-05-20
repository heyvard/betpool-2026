export const stringTilNumber = (prop: string | null): number | null => {
    // Bruk strenge sjekker: med `!prop`/`prop == ''` ville tallet 0 (slik
    // Postgres returnerer scorene) blitt tolket som tomt og gitt null.
    if (prop === null || prop === undefined || prop === '') {
        return null
    }
    return Number(prop)
}
