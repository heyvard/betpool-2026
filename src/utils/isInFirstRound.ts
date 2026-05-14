import dayjs from 'dayjs'

export function erIFørsteRunde(): boolean {
    return førsteRunde.isAfter(dayjs())
}

export const førsteRunde = dayjs('2026-06-26T00:00:00.000Z')

export function erEtterFørsteRunde(): boolean {
    return !erIFørsteRunde()
}
