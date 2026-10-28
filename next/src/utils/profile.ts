/**
 * Public profile links: wallet.blackvemarket.com/u/name.vet (or /u/0x…). The app routes by hash, so a
 * path link is turned into its #/u/… route when the page opens (router/index.ts).
 */

export function profileLink(id: string, origin = window.location.origin): string {
    return `${origin}/u/${encodeURIComponent(id)}`
}

/** the #/u/… route for a /u/… path, or null when the path is not a profile */
export function profilePathToHash(pathname: string): string | null {
    const m = /^\/u\/([^/]+)\/?$/.exec(pathname)
    return m ? `/u/${m[1]}` : null
}
