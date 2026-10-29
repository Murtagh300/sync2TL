import { Certificate } from 'thor-devkit'

/** a signed certificate, checked: who signed what, and when */
export function checkCertificate(text: string): { ok: boolean, signer: string, text: string, time: number, domain: string } {
    const none = { ok: false, signer: '', text: '', time: 0, domain: '' }
    try {
        const c = JSON.parse(text.trim()) as Certificate
        if (!c || c.payload?.type !== 'text' || typeof c.payload.content !== 'string') return none
        Certificate.verify(c)
        return { ok: true, signer: c.signer.toLowerCase(), text: c.payload.content, time: Number(c.timestamp) * 1000, domain: String(c.domain || '') }
    } catch {
        return none
    }
}
