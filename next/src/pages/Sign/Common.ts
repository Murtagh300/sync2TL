import { defineComponent } from 'vue'
import { SignerGroup } from './models'
import { Transaction, secp256k1, Certificate, blake2b256 } from 'thor-devkit'
import { Vault } from 'src/core/vault'
import { canSign } from 'src/utils/watch'

// base of TxDialog and CertDialog (`extends: Common`)
export default defineComponent({
    props: {
        gid: { type: String, required: true },
        req: { type: Object as () => (M.CertRequest | M.TxRequest), required: true }
    },
    data() {
        return {
            signer: '',
            // async computed (see src/shims-async-computed.d.ts)
            wallets: null as M.Wallet[] | null
        }
    },
    computed: {
        wallet(): M.Wallet | null {
            return (this.wallets || []).find(w => w.meta.addresses.includes(this.signer)) || null
        },
        signerGroups(): SignerGroup[] {
            const enforcedSigner = this.req.options.signer
            const wallets = this.wallets || []

            if (enforcedSigner) {
                const w = wallets.find(w => w.meta.addresses.includes(enforcedSigner))
                return [{
                    name: w ? w.meta.name : '',
                    addresses: [enforcedSigner]
                }]
            }
            return wallets.map(w => {
                return {
                    name: w.meta.name,
                    addresses: w.meta.addresses
                }
            })
        }
    },
    asyncComputed: {
        async wallets(): Promise<M.Wallet[] | null> {
            // watch-only wallets have no keys to sign with
            return (await this.$svc.wallet.getByGid(this.gid)).filter(canSign)
        }
    },
    watch: {
        // select the first address if not selected
        signerGroups(groups: SignerGroup[]) {
            if (groups.length > 0 && !groups.find(g => g.addresses.includes(this.signer))) {
                this.signer = groups[0].addresses[0]
            }
        }
    },
    methods: {
        /** remember the signer for the next request on this network; call when the dialog emits ok */
        saveLastSigner() {
            localStorage.setItem(`last-signer-${this.gid}`, this.signer)
        },
        async signTx(wallet: M.Wallet, signer: string, buildTx: () => Promise<Transaction<Transaction.LegacyBody>>): Promise<Buffer> {
            if (wallet.meta.type === 'hd') {
                // acquire user master key
                const umk = await this.$authenticate()

                const tx = await buildTx()
                const vault = Vault.decode(wallet.vault)
                const node = vault.derive(wallet.meta.addresses.indexOf(signer))
                const sk = node.unlock(umk)
                return secp256k1.sign(tx.signingHash(), sk)
            } else {
                throw new Error(`unsupported wallet type '${wallet.meta.type}'`)
            }
        },
        async signCert(wallet: M.Wallet, cert: Certificate): Promise<Buffer> {
            if (wallet.meta.type === 'hd') {
                // acquire user master key
                const umk = await this.$authenticate()

                const vault = Vault.decode(wallet.vault)
                const node = vault.derive(wallet.meta.addresses.indexOf(cert.signer))
                const sk = node.unlock(umk)
                return secp256k1.sign(blake2b256(Certificate.encode(cert)), sk)
            } else {
                throw new Error(`unsupported wallet type '${wallet.meta.type}'`)
            }
        }
    },
    beforeMount() {
        this.signer = localStorage.getItem(`last-signer-${this.gid}`) || '' // load last signer
    }
})
