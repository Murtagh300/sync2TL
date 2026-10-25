/** wallets that hold keys; watch-only ones (an address you follow) can't sign */
export const canSign = (w: M.Wallet | null | undefined): w is M.Wallet => !!w && w.meta.type !== 'watch'
