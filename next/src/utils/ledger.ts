import type Transport from '@ledgerhq/hw-transport'

// WebHID works in Chrome/Edge and in Electron, so one connector serves web and desktop
const connector: { connect(): Promise<Transport> } | null = (() => {
    if (typeof navigator !== 'undefined' && 'hid' in navigator) {
        return {
            connect: async () => (await import('@ledgerhq/hw-transport-webhid')).default.create()
        }
    }
    return null
})()

export const supported = !!connector

// eslint-disable-next-line quotes
export const path = `44'/818'/0'/0`

export function connect() {
    if (!connector) {
        throw new Error('unsupported')
    }
    return connector.connect()
}

export { default as App, StatusCodes } from '@vechain/hw-app-vet'
export type { Account } from '@vechain/hw-app-vet'
