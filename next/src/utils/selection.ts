import { reactive, watch } from 'vue'

/** the wallet the home screen, the NFT tab and quick actions work on; remembered per device */
const KEY = 'selectedWalletId'

export const selection = reactive({
    walletId: parseInt(localStorage.getItem(KEY) || '0')
})

watch(() => selection.walletId, id => {
    try {
        localStorage.setItem(KEY, String(id))
    } catch { }
})

/** the id for "All wallets" on the home screen */
export const ALL_WALLETS = -1

/** the selected wallet among these, or the first (also for "All wallets": actions need one) */
export function selectedWallet(wallets: M.Wallet[] | null | undefined): M.Wallet | null {
    if (!wallets || !wallets.length) {
        return null
    }
    return wallets.find(w => w.id === selection.walletId) || wallets[0]!
}
