import { expect } from '@jest/globals'
import { stringTilNumber } from './stringnumber'

describe('stringTilNumber', () => {
    it('tom streng og null blir null', () => {
        expect(stringTilNumber('')).toBeNull()
        expect(stringTilNumber(null)).toBeNull()
    })

    it('beholder tallet 0 (regresjon: 0 ble tidligere tolket som tomt)', () => {
        expect(stringTilNumber('0')).toEqual(0)
        // Postgres returnerer scoren som et tall, ikke en streng.
        expect(stringTilNumber(0 as unknown as string)).toEqual(0)
    })

    it('parser tallverdier', () => {
        expect(stringTilNumber('3')).toEqual(3)
    })
})
