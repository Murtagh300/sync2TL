import QRCode from 'qrcode-svg'

/**
 * A picture to share (an NFT, or your address with its QR code) in the BlackVault style,
 * drawn on a canvas, shared as a file where the device can, downloaded otherwise.
 */

export type ShareCard = {
    title: string
    subtitle?: string
    /** the NFT; its CDN copy is used, which allows drawing it on a canvas */
    image?: string
    /** a QR code for this text (an address or a link) */
    qr?: string
    accent?: string
}

const W = 1080
const H = 1350

function load(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
    })
}

/** BlackVeMarket images also live on the CDN host, which sends CORS headers */
const cdn = (url: string) => url.replace('.digitaloceanspaces.com/', '.cdn.digitaloceanspaces.com/').replace('.cdn.cdn.', '.cdn.')

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

export async function renderShareCard(card: ShareCard): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    const accent = card.accent || getComputedStyle(document.documentElement).getPropertyValue('--q-primary').trim() || '#6ee7b7'

    // background: near-black with a glow of the accent
    ctx.fillStyle = '#080a09'
    ctx.fillRect(0, 0, W, H)
    const glow = ctx.createRadialGradient(W, 0, 0, W, 0, W * 1.1)
    glow.addColorStop(0, accent + '33')
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif'
    let y = 90
    if (card.image) {
        try {
            const img = await load(cdn(card.image))
            const size = 880
            ctx.save()
            roundRect(ctx, (W - size) / 2, y, size, size, 48)
            ctx.clip()
            ctx.drawImage(img, (W - size) / 2, y, size, size)
            ctx.restore()
            y += size + 70
        } catch {
            y += 40
        }
    } else if (card.qr) {
        const svg = new QRCode({ content: card.qr, padding: 2, width: 640, height: 640, color: '#000', background: '#fff', join: true }).svg()
        const img = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
        ctx.save()
        roundRect(ctx, (W - 680) / 2, y + 60, 680, 680, 40)
        ctx.fillStyle = '#fff'
        ctx.fill()
        ctx.restore()
        ctx.drawImage(img, (W - 640) / 2, y + 80, 640, 640)
        y += 820
    }

    ctx.fillStyle = '#ffffff'
    ctx.font = `900 64px ${font}`
    ctx.textAlign = 'center'
    ctx.fillText(card.title.slice(0, 32), W / 2, y)
    if (card.subtitle) {
        ctx.fillStyle = '#9aa39f'
        ctx.font = `600 38px ${font}`
        ctx.fillText(card.subtitle.slice(0, 48), W / 2, y + 62)
    }
    // the brand at the bottom
    ctx.fillStyle = accent
    ctx.font = `900 34px ${font}`
    ctx.fillText('BlackVault · BlackVeMarket', W / 2, H - 70)

    return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'))
}

/** share the card as an image; download it where sharing files isn't possible */
export async function shareCard(card: ShareCard, text?: string) {
    const blob = await renderShareCard(card)
    const file = new File([blob], `${card.title.replace(/[^\w-]+/g, '-').toLowerCase() || 'blackvault'}.png`, { type: 'image/png' })
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
    if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: card.title, text })
        return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
