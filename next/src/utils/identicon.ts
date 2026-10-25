import { picasso } from '@vechain/picasso'

const cache = new Map<string, string>()

/** the picasso pattern of an address as an image URL (cached: lists show the same few often) */
export function identicon(address: string): string {
    const a = address.toLowerCase()
    let url = cache.get(a)
    if (!url) {
        url = `data:image/svg+xml;utf8,${encodeURIComponent(picasso(a))}`
        if (cache.size > 500) cache.clear()
        cache.set(a, url)
    }
    return url
}
