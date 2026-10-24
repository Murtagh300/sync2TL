// Golden values generated independently of the app code:
// HD keys with ethers v6 (path m/44'/818'/0'/0/i), cipher/kdf globs with Node's
// crypto following the format of core/vault/cipher.ts. If a test against these
// fails, wallets saved by an earlier version may no longer open.

export const words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

export const hd = {
    path: "m/44'/818'/0'/0",
    pub: '03df0d1cd2889abb6724ce526d376a1377479a4e71d95adf955ef5723ad6001e54',
    chainCode: '7d2f4d8d6986567e45ac75d7560d957def3f0ee489f85a794886294117f1b2a9',
    nodes: [
        {
            index: 0,
            address: '0xe5d846748409df0b23d5bd47ceb14afc1cbbbcb3',
            privateKey: '307f098332f41fe361243bcfb6b5605bf7c31052c3cde7a57434cd3199c7f6c0'
        },
        {
            index: 1,
            address: '0xdb62fe39887b1b3b80a05e16596150ccdb12199e',
            privateKey: 'b0c0826a1077d0eb55301d4db20679b5e71c0e198643ea52a767c93279f91ba8'
        },
        {
            index: 5,
            address: '0xb7833dea74c8ac879215a7a5ab11fbed14ae11b4',
            privateKey: '6229ace5e8ecc41385445fa7ad3e8256e93ae1b7b1f2e4ebd66f3112ca08d4e9'
        }
    ]
}

export const staticKey = {
    sk: '7582be841ca040aa940fff6c05773129e135623e41acce3e0b8ba520dc1ae26a',
    address: '0xd989829d88b0ed1b06edf5c50174ecfa64f14a64'
}

/** `words` encrypted with `key` */
export const cipher = {
    key: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    glob: {
        cipherText: 'd8c42076be204a6f3a668055868d24abc91d01a2ccdb1ce612d9f5a74ff3ecf5862365f6f1245a35aa7a22190eb7dac06a30a6fb7a18d2bbabba68018e991d2ab849e9ad4b5fb8d6589dc92b6d5e10eae0fb07108fe25509fd04e6cc30e2d758',
        iv: 'a0a1a2a3a4a5a6a7a8a9aaabacadaeaf',
        mac: 'aec8a7c84982a4aac9b0427787f5f2e7d308e186fd06914999f3584f831f5084'
    }
}

/** `clear` encrypted with a key derived from `password` (PBKDF2-HMAC-SHA256) */
export const kdf = {
    password: 'correct horse battery staple',
    clear: 'hello blackvault',
    key: 'ce8ac8361238bba5ed7d2a14614a1ff2ed1d15674b61af2176238ddeadeaea0a',
    glob: {
        cipherText: '63e27b436d8e6964a345f2c630d26341a0b8f1ec3773d4f20d1101fb43711036',
        iv: 'a0a1a2a3a4a5a6a7a8a9aaabacadaeaf',
        mac: 'ff88e07689c29d964635fa073c5051bb6a9b7603a8fd306127126fe3fb818351',
        kdf: {
            salt: '5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a',
            n: 1024
        }
    }
}
