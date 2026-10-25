import { reactive } from 'vue'

/**
 * Your own notes on transactions ("rent", "paid back Kees"), kept on this device only and
 * shown in the activity list and on the transaction page.
 */
const KEY = 'bv-tx-notes'

function load(): Record<string, string> {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, string>
    } catch {
        return {}
    }
}

export const txNotes = reactive<Record<string, string>>(load())

export function setTxNote(txId: string, note: string) {
    const id = txId.toLowerCase()
    if (note.trim()) {
        txNotes[id] = note.trim().slice(0, 140)
    } else {
        delete txNotes[id]
    }
    try {
        localStorage.setItem(KEY, JSON.stringify(txNotes))
    } catch { }
}

export function txNote(txId: string | null | undefined): string {
    return txId ? txNotes[txId.toLowerCase()] || '' : ''
}
