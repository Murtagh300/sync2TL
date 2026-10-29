/** view calls on a node in one dry run (POST /accounts/*); the raw output per clause, null when it reverted */
export async function callNode(node: string, clauses: { to: string, data: string }[]): Promise<(string | null)[]> {
    const r = await fetch(`${node.replace(/\/$/, '')}/accounts/*`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clauses: clauses.map(c => ({ to: c.to, value: '0x0', data: c.data })) }),
        signal: AbortSignal.timeout(20000)
    })
    if (!r.ok) throw new Error(`node ${r.status}`)
    const out = await r.json() as { data: string, reverted: boolean }[]
    return clauses.map((_, i) => (out[i] && !out[i]!.reverted ? out[i]!.data : null))
}

export const word = (hex: string | null, i = 0) => (hex && hex.length >= 2 + (i + 1) * 64 ? BigInt('0x' + hex.slice(2 + i * 64, 2 + (i + 1) * 64)) : 0n)
export const pad = (v: string | number | bigint) => (typeof v === 'string' ? v.toLowerCase().replace(/^0x/, '') : v.toString(16)).padStart(64, '0')
