import type { RouteRecordRaw } from 'vue-router'
import Main from 'layouts/Main'
import Index from 'pages/Index'
import Address from 'pages/Address'
import Asset from 'pages/Asset'
import Backup from 'pages/Backup'
import NewWallet from 'pages/NewWallet'
import Send from 'pages/Send'
import Settings from 'pages/Settings'
import TokensSetting from 'pages/TokensSetting.vue'
import NodesSetting from 'pages/NodesSetting'
import Sign from 'pages/Sign'
import SignSuccess from 'pages/SignSuccess.vue'
import Activities from 'pages/Activities'
import Nft from 'pages/Nft'
import Approvals from 'pages/Approvals'
import Contacts from 'pages/Contacts'
import Watchlist from 'pages/Watchlist'
import Launchpad, { Launch } from 'pages/Launchpad'
import Swap from 'pages/Swap'
import Nfts from 'pages/Nfts'
import More from 'pages/More'
import Search from 'pages/Search'
import TxDetail from 'pages/TxDetail'
import Collection from 'pages/Collection'
import Notifications from 'pages/Notifications'
import Portfolio from 'pages/Portfolio'
import Payments from 'pages/Payments'
import Payout from 'pages/Payout'
import Overview from 'pages/Overview'
import SwitchGuide from 'pages/SwitchGuide'
import { Dust, Consolidate } from 'pages/Tidy'
import Liquidity from 'pages/Liquidity'
import Emergency from 'pages/Emergency'
import Security, { Dapps } from 'pages/Security'

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        component: Main,
        children: [{
            path: '',
            name: 'index',
            component: Index
        }, {
            path: 'w/:walletId(\\d+)/:addressIndex(\\d+)',
            name: 'address',
            component: Address
        }, {
            path: 'w/:walletId(\\d+)/:addressIndex(\\d+)/:symbol',
            name: 'asset',
            component: Asset
        }, {
            path: 'w/:walletId(\\d+)/:addressIndex(\\d+)/nft/:contract/:tokenId',
            name: 'nft',
            component: Nft
        }, {
            path: 'w/:walletId(\\d+)/:addressIndex(\\d+)/approvals',
            name: 'approvals',
            component: Approvals
        }, {
            path: 'w/:walletId(\\d+)/backup',
            name: 'backup',
            component: Backup
        }, {
            path: 'new-wallet',
            name: 'new-wallet',
            component: NewWallet
        }, {
            path: 'send',
            name: 'send',
            component: Send
        }, {
            path: 'nfts',
            name: 'nfts',
            component: Nfts
        }, {
            path: 'more',
            name: 'more',
            component: More
        }, {
            path: 'liquidity',
            name: 'liquidity',
            component: Liquidity
        }, {
            path: 'emergency',
            name: 'emergency',
            component: Emergency
        }, {
            path: 'payments',
            name: 'payments',
            component: Payments
        }, {
            path: 'portfolio',
            name: 'portfolio',
            component: Portfolio
        }, {
            path: 'notifications',
            name: 'notifications',
            component: Notifications
        }, {
            path: 'collection/:slug',
            name: 'collection',
            component: Collection
        }, {
            path: 'tx/:gid/:txId',
            name: 'tx',
            component: TxDetail
        }, {
            path: 'security',
            name: 'security',
            component: Security
        }, {
            path: 'dapps',
            name: 'dapps',
            component: Dapps
        }, {
            path: 'search',
            name: 'search',
            component: Search
        }, {
            path: 'dust',
            name: 'dust',
            component: Dust
        }, {
            path: 'consolidate',
            name: 'consolidate',
            component: Consolidate
        }, {
            path: 'switch-guide',
            name: 'switch-guide',
            component: SwitchGuide
        }, {
            path: 'overview',
            name: 'overview',
            component: Overview
        }, {
            path: 'payout',
            name: 'payout',
            component: Payout
        }, {
            path: 'swap',
            name: 'swap',
            component: Swap
        }, {
            path: 'launchpad',
            name: 'launchpad',
            component: Launchpad
        }, {
            path: 'launchpad/:slug',
            name: 'launch',
            component: Launch
        }, {
            path: 'watchlist',
            name: 'watchlist',
            component: Watchlist
        }, {
            path: 'contacts',
            name: 'contacts',
            component: Contacts
        }, {
            path: 'settings',
            name: 'settings',
            component: Settings
        }, {
            path: 'tokens-setting',
            name: 'tokens-setting',
            component: TokensSetting
        }, {
            path: 'nodes-setting',
            name: 'nodes-setting',
            component: NodesSetting
        }, {
            // this entry is to handle external signing request in SPA mode only
            path: 'sign',
            name: 'sign',
            component: Sign
        }, {
            path: 'sign-success',
            name: 'sign-success',
            component: SignSuccess
        }, {
            path: 'activities',
            name: 'activities',
            component: Activities
        }]
    },
    // Always leave this as last one
    {
        path: '/:catchAll(.*)*',
        redirect: '/'
    }
]

export default routes
