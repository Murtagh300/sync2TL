
export default {
    common: {
        ok: 'OK',
        confirm: 'Confirm',
        dismiss: 'Dismiss',
        delete: 'Delete',
        add: 'Add',
        cancel: 'Cancel',
        finish: 'Done',
        next: 'Next',
        decline: 'Decline',
        copy: 'Copy',
        copied: 'Copied',
        close: 'Close',
        continue: 'Continue',
        view: 'View',

        // networks
        mainnet: 'Mainnet',
        testnet: 'Testnet',
        private: 'Private network',

        // error_message
        required_field: 'This field is required',
        something_wrong: 'Something went wrong. Try again.',
        no_wallet: 'No wallet yet',
        invalid_input: 'That does not match',

        // notify
        wallet_updated: 'Wallet updated',
        wallet_created: 'Wallet created',
        wallet_deleted: 'Wallet removed',

        lang_auto: 'Automatic',

        transaction: 'Transaction',
        certificate: 'Signature request',
        identification: 'Sign in',
        agreement: 'Agreement',
        unknown: 'Unknown',
        sent: 'Sent',
        received: 'Received'
    },
    disclaimer: {
        msg_unstable_terms: 'This is a preview build of BlackVault. It can contain serious bugs that lose data. Do not use it for wallets that hold real assets on mainnet. It is meant for testing and feedback.',
        label_unstable_terms_accept: 'I understand the risk',

        msg_disclaimer_terms: 'BlackVault keeps your private keys, recovery words and password only on this device, encrypted. Nobody, including BlackVeMarket, can see or recover them for you. You are responsible for backing up your recovery words and keeping them safe: if they are lost, forgotten or stolen, so are your assets. BlackVeMarket and the BlackVault developers are not liable for any loss.',
        label_disclaimer_terms_accept: 'I understand that my keys are my responsibility'
    },
    wizard: {
        title_welcome: 'Your VeChain vault.',
        title_init: 'Setting up your vault',
        title_feature_1: 'Your keys stay on this device, encrypted with your password',
        title_feature_2: 'Send and receive',
        title_feature_3: 'Sign in to dApps',
        msg_feature_1: 'The wallet by BlackVeMarket for VET, VTHO, tokens, NFTs and every VeChain dApp.',
        msg_feature_2: 'VET, VTHO, tokens and NFTs in one place.',
        msg_feature_3: 'Approve transactions and logins.',
        msg_init_animation_s1: 'Creating your master key',
        msg_init_animation_s2: 'Encrypting it with your password',
        msg_init_animation_s3: 'Generating recovery words',
        msg_init_animation_s4: 'Encrypting your wallet',
        msg_init_animation_s5: 'Saving it on this device',
        msg_init_complete: 'Your wallet is ready.',
        action_get_started: 'Create my wallet'
    },
    index: {
        action_new_address: 'Add address',
        action_backup: 'Back up',
        action_rename: 'Rename',
        action_upgrade: 'Restart to update',
        action_backup_now: 'Back up now',
        action_settings: 'Settings',
        action_activities: 'Activity',
        action_create: 'Create a wallet',
        msg_upgrade: 'A new version of BlackVault is ready.',
        // request user to enter "ok" to confirm
        msg_delete: 'Type "ok" to remove this wallet from BlackVault. Without a backup of its recovery words it is gone for good.',
        msg_backup: 'Back up this wallet. Without its recovery words you cannot restore it.',
        label_wallets: 'Wallets'
    },
    newWallet: {
        title: 'Add a wallet',
        msg_mnemonic_error: 'These recovery words are not valid',
        mnemonic_words_count: 'Number of words',
        action_generate: 'Create a new wallet',
        action_import: 'Import recovery words',
        msg_generate: 'Get new recovery words and a fresh address.',
        msg_import: 'Restore a wallet from its 12 or 24 words.',
        msg_ledger: 'Use the keys on your Ledger device.',
        label_wallet_name: 'Wallet name',
        label_mnemonic: 'Recovery words, separated by spaces',
        label_advance: 'Advanced',
        action_custom_path: 'Custom',
        action_vet_path: 'VeChain',
        action_eth_path: 'Ethereum',
        label_path: 'Derivation path',
        msg_example: 'Example',
        msg_invalid_path: 'Invalid path',
        label_ledger_user: 'Have a Ledger?',
        action_ledger_link: 'Connect a Ledger'
    },
    authenticationDialog: {
        title: 'Unlock',
        msg_password_error: 'Wrong password',
        action_unlock: 'Unlock',
        label_input_password: 'Enter your BlackVault password'
    },
    settings: {
        title: 'Settings',
        action_change_password: 'Change password',
        action_token_list: 'Tokens',
        action_nodes: 'Network nodes',
        action_language: 'Language',
        msg_password_changed: 'Password changed',
        action_user_guide: 'BlackVeMarket',
        label_general: 'General',
        label_network: 'Network'
    },
    tokens: {
        msg_auto: 'Tokens you hold show up on their own. Switch one on to always show it, even with a zero balance.',
        label_search: 'Search tokens',
        msg_no_match: 'No token matches that'
    },
    nodes: {
        title_add_dialog: 'Add a node',
        msg_node_added: 'Node added',
        msg_node_deleted: 'Node removed',
        msg_node_existed: 'This node is already in the list',
        msg_delete: 'Remove this node?'
    },
    address: {
        title: 'Address',
        label_assets: 'Tokens',
        action_receive: 'Receive'
    },
    nft: {
        label_nfts: 'NFTs',
        label_all: 'All',
        label_collection: 'Collection',
        label_traits: 'Traits',
        label_details: 'Details',
        label_rank: 'Rank',
        label_last_sale: 'Last sale',
        label_listed: 'Listed for',
        label_unlisted: 'Not listed',
        label_contract: 'Contract',
        label_token_id: 'Token ID',
        label_standard: 'Standard',
        action_send: 'Send NFT',
        action_view_market: 'View on BlackVeMarket',
        action_explore: 'Explore BlackVeMarket',
        action_load_more: 'Load more',
        action_retry: 'Try again',
        msg_empty: 'No NFTs on this address yet.',
        msg_unreachable: 'BlackVeMarket can not be reached right now.',
        msg_listed_cannot_send: 'Listed on BlackVeMarket. Cancel the listing there before sending it.',
        msg_send_to: 'Address to send this NFT to',
        msg_sent: 'NFT sent. BlackVeMarket shows it in the new wallet once the transfer is confirmed.',
        msg_not_owner: 'This address no longer holds this NFT.'
    },
    asset: {
        title: 'Token',
        label_history: 'History',
        msg_no_history: 'No transfers yet. What you send and receive shows up here.',
        msg_no_more: 'That is all'
    },
    send: {
        title: 'Send',
        label_to: 'To',
        label_amount: 'Amount',
        label_asset: 'Token',
        label_recent_transfer: 'Recent',
        msg_invalid_amount: 'Enter a valid amount',
        msg_invalid_address: 'Enter a valid VeChain address',
        msg_invalid_address_checksum: 'This address has a typo (its checksum does not match)',
        action_send: 'Send'
    },
    activities: {
        title: 'Activity',
        title_signed_content: 'What you signed',
        label_reverted: 'Failed',
        label_expired: 'Expired',
        label_sending: 'Sending',
        msg_not_found: 'No activity yet. Transactions and signatures you approve show up here.'
    },
    newPasswordDialog: {
        msg_password_mismatch: 'The passwords do not match',
        msg_password_too_short: 'Use at least 6 characters',
        title_set_new_password: 'Choose a password',
        title_confirm_password: 'Repeat your password'
    },
    backup: {
        title: 'Back up',
        action_next_verify: 'Check my words',
        label_backed_up: 'Backup complete',
        msg_backed_up: 'Keep your recovery words offline and never share them with anyone.',
        msg_confirm_your_mnemonic: 'Tap the words in the right order',
        msg_backup_intro: 'Your recovery words are the only way to restore this wallet, for example on a new device.',
        label_backup_tips: 'Before you start',
        msg_backup_tips_1: 'Write the words down in order',
        msg_backup_tips_2: 'Store them somewhere safe and offline',
        msg_backup_tips_3: 'Do not take a screenshot or photo',
        label_your_mnemonic: 'Your recovery words',

        // notify
        msg_wallet_not_found: 'Wallet not found'
    },
    sign: {
        title: 'Request',
        msg_loading_content: 'Loading the request…',
        msg_loading_failed: 'Could not load the request',
        msg_request_signature: 'A dApp asks for your signature',
        label_request_from: 'From',
        label_request_type: 'Type',
        label_request_summary: 'Summary',
        label_purpose: 'Purpose',
        msg_invalid_request: 'This request is not valid',
        msg_fetch_request_failed: 'Could not load the request. Try again from the dApp.',
        msg_request_hash_mismatch: 'This request was changed on its way. Do not sign it.',
        msg_fee_delegation: 'The dApp pays the fee',

        // sign success
        title_success: 'Done',
        msg_signed: 'You signed the {content_type}',
        action_view_activities: 'View activity',

        // sign tx/cert
        label_select_priority: 'Speed',
        label_estimate_fee: 'Fee',
        label_priority_regular: 'Regular',
        label_priority_medium: 'Faster',
        label_priority_high: 'Fastest',
        action_sign: 'Sign',

        // error occurred
        label_insufficient_vtho: 'Not enough VTHO',
        msg_insufficient_vtho: 'There is not enough VTHO to pay the fee',
        label_transaction_warning: 'This transaction may fail',
        label_critical_error: 'Can not sign this',
        label_vm_error: 'The simulation failed',
        msg_delegation_failed: 'The dApp could not pay the fee',
        msg_address_not_owned: 'The requested address is not in BlackVault',
        msg_vip191_not_supported: 'This network does not support fee delegation (VIP-191)',

        // clause op type
        op_transfer_asset: 'Transfer',
        op_nft_transfer: 'NFT transfer',
        op_contract_call: 'Contract call',
        op_contract_creation: 'Contract deployment',

        title_ask_create_wallet: 'No wallet on this network',
        message_ask_create_wallet: 'Create one now?'
    },
    ledger: {
        title_connecting: 'Connecting',
        title_reading_data: 'Reading your Ledger',
        title_checking_status: 'Checking the app',
        title_signing_data: 'Signing',
        // hints
        msg_connecting: 'Connect and unlock your Ledger',
        msg_checking_status: 'Open the VeChain app on your Ledger',
        msg_signing_data: 'Confirm on your Ledger',
        // errors
        msg_wrong_device: 'This is not the Ledger of this wallet',
        msg_unknown_data: 'Unknown data type',
        label_link: 'Connect'
    },
    bioAuth: {
        title: 'Biometric unlock',
        msg_auth_failed: 'Not recognized. Try again.'
    }
}
