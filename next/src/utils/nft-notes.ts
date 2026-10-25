import type { Service } from 'boot/services'
import { nftKey } from './hidden-nfts'

/** a private note and labels per NFT, kept on this device ("not for sale", "a gift for…") */
export type NftNote = { note: string, labels: string[] }
export type NftNotes = Record<string, NftNote>

export const SUGGESTED_LABELS = ['keep', 'for_sale', 'gift', 'grail']

export function loadNotes(svc: Service): Promise<NftNotes> {
    return svc.config.getJSON<NftNotes>('nft-notes', {})
}

export async function saveNote(svc: Service, nft: { contract: string, tokenId: string }, value: NftNote): Promise<NftNotes> {
    const all = await loadNotes(svc)
    const key = nftKey(nft.contract, nft.tokenId)
    const clean = { note: value.note.trim(), labels: [...new Set(value.labels.map(l => l.trim()).filter(Boolean))] }
    if (!clean.note && !clean.labels.length) {
        delete all[key]
    } else {
        all[key] = clean
    }
    await svc.config.setJSON('nft-notes', all)
    return all
}

export function noteOf(notes: NftNotes, nft: { contract: string, tokenId: string }): NftNote | null {
    return notes[nftKey(nft.contract, nft.tokenId)] || null
}
