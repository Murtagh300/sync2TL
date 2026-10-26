import { beforeEach, describe, expect, it } from 'vitest'
import { Storage } from 'core/storage'

let db: Storage

beforeEach(async () => {
    db = await Storage.init()
    await db.configs.delete({})
    await db.wallets.delete({})
    await db.activities.delete({})
})

function activity(walletId: number, createdTime: number, status: '' | 'completed' = ''): Partial<Storage.ActivityEntity> {
    return { gid: 'g', type: 'tx', walletId, createdTime, status, glob: '{}' }
}

describe('configs (compound key)', () => {
    it('upserts by key+subKey', async () => {
        await db.configs.insert({ key: 'nodes', subKey: '', value: 'a' }, true)
        await db.configs.insert({ key: 'nodes', subKey: '', value: 'b' }, true)
        await db.configs.insert({ key: 'nodes', subKey: 'x', value: 'c' }, true)

        expect(await db.configs.all().where({ key: 'nodes', subKey: '' }).query())
            .toEqual([{ key: 'nodes', subKey: '', value: 'b' }])
        expect(await db.configs.all().query()).toHaveLength(2)
    })
})

describe('wallets (auto increment)', () => {
    it('assigns increasing ids and filters by index', async () => {
        const a = await db.wallets.insert({ gid: 'main', vault: 'v1', meta: '{}' })
        const b = await db.wallets.insert({ gid: 'test', vault: 'v2', meta: '{}' })
        expect(b).toBeGreaterThan(a)

        const main = await db.wallets.all().where({ gid: 'main' }).query()
        expect(main.map(w => w.vault)).toEqual(['v1'])
    })

    it('updates and deletes by condition', async () => {
        const id = await db.wallets.insert({ gid: 'main', vault: 'v1', meta: '{}' })
        await db.wallets.insert({ gid: 'test', vault: 'v2', meta: '{}' })

        await db.wallets.update({ id }, { meta: '{"name":"x"}' })
        expect((await db.wallets.all().where({ id }).query())[0]!.meta).toBe('{"name":"x"}')

        await db.wallets.delete({ gid: 'test' })
        expect(await db.wallets.all().query()).toHaveLength(1)
    })

    it('updates all rows with an empty condition', async () => {
        await db.wallets.insert({ gid: 'main', vault: 'v1', meta: '{}' })
        await db.wallets.insert({ gid: 'test', vault: 'v2', meta: '{}' })
        await db.wallets.update({}, { meta: 'm' })
        expect((await db.wallets.all().query()).every(w => w.meta === 'm')).toBe(true)
    })
})

describe('activities (query options)', () => {
    beforeEach(async () => {
        for (let i = 1; i <= 5; i++) {
            await db.activities.insert(activity(i % 2 ? 1 : 2, i * 10, i <= 2 ? 'completed' : ''))
        }
    })

    it('excludes by a single indexed key', async () => {
        const pending = await db.activities.all().except({ status: 'completed' }).query()
        expect(pending.map(a => a.createdTime)).toEqual([30, 40, 50])
    })

    it('combines where and except', async () => {
        const rows = await db.activities.all().where({ walletId: 1 }).except({ status: 'completed' }).query()
        expect(rows.map(a => a.createdTime)).toEqual([30, 50])
    })

    it('reverses, then pages with limit and offset', async () => {
        const rows = await db.activities.all().reverse().limit(2, 1).query()
        expect(rows.map(a => a.createdTime)).toEqual([40, 30])
    })
})

describe('observe', () => {
    it('resolves after a change, not before', async () => {
        const ob = db.wallets.observe()
        let fired = false
        const p = ob.changed().then(() => { fired = true })
        await Promise.resolve()
        expect(fired).toBe(false)

        await db.wallets.insert({ gid: 'main', vault: 'v', meta: '{}' })
        await p
        expect(fired).toBe(true)
    })
})

describe('transaction', () => {
    it('rolls back every write when the scope throws', async () => {
        await expect(db.transaction(async () => {
            await db.wallets.insert({ gid: 'main', vault: 'v', meta: '{}' })
            await db.configs.insert({ key: 'k', subKey: '', value: 'v' }, true)
            throw new Error('abort')
        })).rejects.toThrow('abort')

        expect(await db.wallets.all().query()).toHaveLength(0)
        expect(await db.configs.all().query()).toHaveLength(0)
    })
})
