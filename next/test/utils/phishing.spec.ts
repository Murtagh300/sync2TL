import { describe, expect, it } from 'vitest'
import { distance, isOfficial, lookalikeLabel } from 'src/utils/phishing'

describe('phishing', () => {
    it('knows official sites and their subdomains', () => {
        expect(isOfficial('governance.vebetterdao.org')).toBe(true)
        expect(isOfficial('vebetterdao.org.evil.com')).toBe(false)
        expect(isOfficial('wallet.example.com', ['wallet.example.com'])).toBe(true)
    })

    it('counts edits', () => {
        expect(distance('vebetterdao', 'vebeterdao')).toBe(1)
        expect(distance('betterswap', 'betterswqp')).toBe(1)
        expect(distance('abc', 'xyzxyz')).toBe(3)
    })

    it('flags a copied name as danger, a borrowed one as a warning', () => {
        expect(lookalikeLabel('vebeterdao.org')).toEqual({ level: 'danger', key: 'site_lookalike', params: { site: 'vebetterdao.org' } })
        expect(lookalikeLabel('app.betterswqp.io')?.key).toBe('site_lookalike')
        expect(lookalikeLabel('vebetterdao-claim.com')).toEqual({ level: 'warn', key: 'site_brand', params: { name: 'vebetter' } })
        expect(lookalikeLabel('www.betterswap.io')).toBeNull()
        expect(lookalikeLabel('mugshot.vip')).toBeNull()
        expect(lookalikeLabel('localhost:8090')).toBeNull()
    })
})
