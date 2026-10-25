import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import enUS from 'src/i18n/en-us'

type Tree = { [k: string]: string | Tree }

function files(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) return name === 'i18n' ? [] : files(p)
        return /\.(vue|ts)$/.test(name) ? [p] : []
    })
}

const has = (path: string) => {
    let node: string | Tree | undefined = enUS as Tree
    for (const k of path.split('.')) {
        if (!node || typeof node === 'string') return false
        node = node[k]
    }
    return typeof node === 'string'
}

describe('texts the code asks for', () => {
    it('all exist in English', () => {
        const missing: string[] = []
        for (const f of files(join(__dirname, '../../src'))) {
            const src = readFileSync(f, 'utf8')
            // literal keys only: $t('a.b'), t('a.b'), this.$t("a.b")
            for (const m of src.matchAll(/(?:\$t|\bt)\(\s*['"]([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)['"]/g)) {
                if (!has(m[1]!)) missing.push(`${m[1]} (${f.split(/[\\/]src[\\/]/)[1]})`)
            }
        }
        expect(missing).toEqual([])
    })
})
