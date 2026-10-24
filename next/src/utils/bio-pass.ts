/** it provides biometric password saving service */
export interface BioPass {
    /** type of biometric authentication */
    readonly authType: 'face' | 'finger'

    /** save the secret */
    save(title: string, cancelButtonTitle: string, secret: string): Promise<void>

    /** recall the saved secret */
    recall(title: string, cancelButtonTitle: string): Promise<string>

    /** show authentication dialogue */
    show(title: string, cancelButtonTitle: string): Promise<void>
}

export namespace BioPass {
    /**
     * the biometric store of the device, null when there is none.
     * Only the native app has one; it is implemented with Capacitor in phase 6.
     */
    export async function open(): Promise<BioPass | null> {
        return null
    }
}
