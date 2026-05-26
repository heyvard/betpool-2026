const navnNo: Record<number, string> = {
    4: 'Sekstendelsfinale',
    5: 'Åttendedelsfinale',
    6: 'Kvartfinale',
    7: 'Semifinale',
    8: 'Bronsefinale',
    9: 'Finale',
}

const navnFr: Record<number, string> = {
    4: 'Seizièmes de finale',
    5: 'Huitièmes de finale',
    6: 'Quarts de finale',
    7: 'Demi-finales',
    8: 'Match pour la 3e place',
    9: 'Finale',
}

export function rundeTilTekst(runde: number, locale: 'no' | 'fr' = 'no') {
    const tabell = locale === 'fr' ? navnFr : navnNo
    if (tabell[runde]) return tabell[runde]
    return locale === 'fr' ? `Phase de groupes ronde ${runde}` : `Gruppespill runde ${runde}`
}
