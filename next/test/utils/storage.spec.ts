import { describe, it, expect } from 'vitest'
import { migrate, fromTheFuture, SCHEMA, type KV } from 'src/utils/migrations'
import { encryptSettings, decryptSettings, pickSettings, summarize, BackupError } from 'src/utils/settings-backup'
import { releases, releaseItems } from 'src/changelog'
import pkg from '../../package.json'

function memory(init: Record<string, string> = {}): KV & { data: Record<string, string> } {
    const data = { ...init }
    return {
        data,
        get length() { return Object.keys(data).length },
        key: i => Object.keys(data)[i] ?? null,
        getItem: k => (k in data ? data[k]! : null),
        setItem: (k, v) => { data[k] = String(v) },
        removeItem: k => { delete data[k] }
    }
}

describe('storage migrations', () => {
    it('runs every migration once on a fresh device', () => {
        const kv = memory()
        expect(migrate(kv).length).toBe(SCHEMA)
        expect(kv.data['bv-schema']).toBe(String(SCHEMA))
        expect(migrate(kv)).toEqual([])
    })

    it('sets broken JSON aside instead of losing it', () => {
        const kv = memory({ 'bv-payments': '{oops', 'bv-tx-notes': '{"a":"b"}' })
        migrate(kv)
        expect(kv.data['bv-payments']).toBeUndefined()
        expect(kv.data['bv-payments.corrupt']).toBe('{oops')
        expect(kv.data['bv-tx-notes']).toBe('{"a":"b"}')
    })

    it('keeps known preferences, drops unknown ones and never turns error reports on', () => {
        const kv = memory({ 'bv-prefs': JSON.stringify({ currency: 'USD', old: 1, errorReports: true }) })
        migrate(kv)
        expect(JSON.parse(kv.data['bv-prefs']!)).toEqual({ currency: 'USD', errorReports: false })
    })

    it('stops at a failing migration and tries again next time', () => {
        const kv = memory({ 'bv-schema': '1', 'bv-prefs': '"text"' })
        migrate(kv)
        // a string is not an object: set aside, schema moves on
        expect(kv.data['bv-prefs.corrupt']).toBe('"text"')
        expect(kv.data['bv-schema']).toBe(String(SCHEMA))
    })

    it('knows when a newer app wrote the storage', () => {
        expect(fromTheFuture(memory({ 'bv-schema': String(SCHEMA + 1) }))).toBe(true)
        expect(fromTheFuture(memory({ 'bv-schema': String(SCHEMA) }))).toBe(false)
    })
})

describe('settings backup', () => {
    const settings = {
        local: { 'bv-prefs': '{"currency":"USD"}', 'bv-tx-notes': '{"0x1":"rent"}' },
        config: { contacts: '[{"name":"A","address":"0x1"},{"name":"B","address":"0x2"}]', 'nft-notes': '{"x":"y"}' }
    }

    it('encrypts and decrypts with the password', async () => {
        const file = await encryptSettings(settings, 'correct horse', 100000)
        expect(file.data).not.toContain('rent')
        expect(await decryptSettings(JSON.stringify(file), 'correct horse')).toEqual(pickSettings(settings))
    })

    it('refuses a wrong password and files that are not backups', async () => {
        const file = await encryptSettings(settings, 'correct horse', 100000)
        await expect(decryptSettings(JSON.stringify(file), 'wrong horse')).rejects.toEqual(new BackupError('password'))
        await expect(decryptSettings('{"format":"other"}', 'x')).rejects.toEqual(new BackupError('format'))
        await expect(decryptSettings('not json', 'x')).rejects.toEqual(new BackupError('format'))
        // a file asking for very few rounds is not trusted
        await expect(decryptSettings(JSON.stringify({ ...file, kdf: { ...file.kdf, iterations: 1 } }), 'correct horse')).rejects.toEqual(new BackupError('format'))
    })

    it('only takes the listed keys, never keys, wallets or nodes', () => {
        const picked = pickSettings({
            local: { 'bv-prefs': '{}', selectedWalletId: '2', 'bv-wc-start': 'x' },
            config: { contacts: '[]', userMasterKeyGlob: 'secret', 'bio-pass-on': 't', nodes: '[{"url":"https://evil.example"}]' }
        })
        expect(picked).toEqual({ local: { 'bv-prefs': '{"errorReports":false}' }, config: { contacts: '[]' } })
    })

    it('never turns error reports on from a file', () => {
        const picked = pickSettings({ local: { 'bv-prefs': '{"currency":"USD","errorReports":true}' }, config: {} })
        expect(JSON.parse(picked.local['bv-prefs']!)).toEqual({ currency: 'USD', errorReports: false })
        expect(pickSettings({ local: { 'bv-prefs': 'nonsense' }, config: {} }).local).toEqual({})
    })

    it('summarizes what a backup holds', () => {
        expect(summarize(settings)).toEqual({ contacts: 2, notes: 2, settings: 4, names: 'A, B' })
    })
})

describe('changelog', () => {
    it('has the current version, in every language', () => {
        const current = releases.find(r => r.version === pkg.version)
        expect(current).toBeTruthy()
        for (const lang of ['en', 'nl', 'de', 'fr', 'zh']) {
            expect(current!.items[lang]?.length).toBe(current!.items.en!.length)
        }
        expect(releaseItems(current!, 'es-es')).toEqual(current!.items.en)
    })
})
