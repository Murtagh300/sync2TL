import { describe, it, expect, beforeEach } from 'vitest'
import { breakerAllows, breakerResult, resetBreakers, retryDelay } from 'src/utils/net'
import { compareVersions, downServices, featureOn, noticeText, remote } from 'src/utils/remote-config'
import { scrub, buildReport } from 'src/utils/error-reports'

describe('circuit breaker', () => {
    beforeEach(() => resetBreakers())

    it('opens after five failures and lets one probe through after the pause', () => {
        for (let i = 0; i < 4; i++) breakerResult('a', false, 0)
        expect(breakerAllows('a', 0)).toBe(true)
        breakerResult('a', false, 0)
        expect(breakerAllows('a', 1000)).toBe(false)
        expect(breakerAllows('a', 31000)).toBe(true)
        // only one probe at a time
        expect(breakerAllows('a', 31001)).toBe(false)
        breakerResult('a', true, 31002)
        expect(breakerAllows('a', 31003)).toBe(true)
    })

    it('keeps hosts apart', () => {
        for (let i = 0; i < 5; i++) breakerResult('a', false, 0)
        expect(breakerAllows('b', 0)).toBe(true)
    })
})

describe('retry delay', () => {
    it('grows and follows Retry-After', () => {
        expect(retryDelay(0)).toBeGreaterThanOrEqual(300)
        expect(retryDelay(0)).toBeLessThanOrEqual(500)
        expect(retryDelay(3)).toBeGreaterThan(2000)
        expect(retryDelay(9)).toBeLessThanOrEqual(6250)
        expect(retryDelay(0, '3')).toBe(3000)
        expect(retryDelay(0, '999')).toBe(10000)
    })
})

describe('remote config', () => {
    it('compares versions', () => {
        expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
        expect(compareVersions('1.10.0', '1.9.9')).toBe(1)
        expect(compareVersions('0.9.0', '1.0.0')).toBe(-1)
        expect(compareVersions('2.0.0-beta', '2.0.0')).toBe(0)
    })

    it('only switches features off', () => {
        remote.flags = { version: 1, features: { swap: false }, notice: null, minVersion: '0.0.0' }
        expect(featureOn('swap')).toBe(false)
        expect(featureOn('payout')).toBe(true)
        remote.flags = null
        expect(featureOn('swap')).toBe(true)
    })

    it('picks the notice in the language, falling back to English', () => {
        const flags = { version: 1, features: {}, notice: { level: 'info' as const, text: { en: 'hi', nl: 'hoi' } }, minVersion: '0.0.0' }
        expect(noticeText(flags, 'nl-nl')).toBe('hoi')
        expect(noticeText(flags, 'de-de')).toBe('hi')
        expect(noticeText(null, 'en-us')).toBe('')
    })

    it('names the services that are down', () => {
        expect(downServices({ ok: false, at: '', checks: [{ name: 'node 1 (a)', ok: false }, { name: 'node 2 (b)', ok: false }, { name: 'BetterSwap', ok: false }, { name: 'BlackVeMarket', ok: true }] }))
            .toEqual(['VeChain', 'BetterSwap'])
        expect(downServices({ ok: true, at: '', checks: [{ name: 'node 1 (a)', ok: false }, { name: 'node 2 (b)', ok: true }] })).toEqual([])
    })
})

describe('error reports', () => {
    it('removes what could identify someone', () => {
        const words = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
        const out = scrub(`sent 12.5 VET to 0x${'ab'.repeat(20)} (alice.vet) ${words} https://x.io/a/0x${'cd'.repeat(20)}?k=1 block 19876543`)
        expect(out).not.toMatch(/abab|cdcd|alice|abandon|12\.5|19876543|k=1/)
        expect(out).toContain('https://x.io/a/')
    })

    it('keeps a route name only when it is a name', () => {
        expect(buildReport(new Error('x'), 'send').route).toBe('send')
        expect(buildReport(new Error('x'), '/w/1/0x12').route).toBe('')
        expect(buildReport('plain', '').message).toBe('plain')
    })
})
