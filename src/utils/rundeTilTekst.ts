export function rundeTilTekst(runde: number) {
    switch (runde) {
        case 4:
            return 'Sekstendelsfinale'
        case 5:
            return 'Åttendedelsfinale'
        case 6:
            return 'Kvartfinale'
        case 7:
            return 'Semifinale'
        case 8:
            return 'Bronsefinale'
        case 9:
            return 'Finale'
    }
    return 'Gruppespill runde ' + runde
}
