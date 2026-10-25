// Refreshes src/utils/known-markets.ts from BlackVeMarket's collection list.
// Run it when a new collection is added, and review the diff before committing.
const fs = require('fs')
const path = require('path')

async function main() {
    const resp = await fetch('https://blackvemarket.com/api/collections')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const { items = [] } = await resp.json()
    const markets = [...new Set(items
        .map(i => String(i.collection?.maasContract || '').toLowerCase())
        .filter(a => /^0x[0-9a-f]{40}$/.test(a) && !/^0x0+$/.test(a)))].sort()
    if (!markets.length) throw new Error('no markets in the response')

    const lines = []
    for (let i = 0; i < markets.length; i += 3) {
        lines.push('    ' + markets.slice(i, i + 3).map(a => `'${a}'`).join(', '))
    }
    const out = `/**
 * BlackVeMarket marketplace contracts (one per collection), bundled with the wallet so a
 * signature for one of them does not rest on what the API says at runtime. Snapshot of
 * ${new Date().toISOString().slice(0, 10)} from /api/collections; refresh with \`npm run markets\`.
 */
export const KNOWN_MARKETS: ReadonlySet<string> = new Set([
${lines.join(',\n')}
])
`
    fs.writeFileSync(path.join(__dirname, '../src/utils/known-markets.ts'), out)
    console.log(`${markets.length} marketplace contracts`)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
