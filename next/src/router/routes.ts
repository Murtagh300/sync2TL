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
import Pnl from 'pages/Pnl'
import { Listings, OfferInbox } from 'pages/Market'
import { Discover, Leaderboard, Stargate, VeBetter, Vote, Validators, VthoTank, Impact, Proposals, VoterRewards } from 'pages/Ecosystem'
import SendQueue from 'pages/SendQueue'
import YearReview from 'pages/YearReview'
import Help from 'pages/Help'
import WalletConnect from 'pages/WalletConnect'
import SwitchGuide from 'pages/SwitchGuide'
import { Dust, Consolidate } from 'pages/Tidy'
import Liquidity from 'pages/Liquidity'
import Emergency from 'pages/Emergency'
import Panic from 'pages/Panic'
import VetName from 'pages/Names'
import Pos from 'pages/Pos'
import Yield from 'pages/Yield'
import Practice from 'pages/Practice'
import Chat from 'pages/Chat'
import Tap from 'pages/Tap'
import SignMessage from 'pages/SignMessage'
import Statement from 'pages/Statement'
import { ShopSetup, Checkout } from 'pages/Shop'
import { Invoices, DonateButton } from 'pages/Invoices'
import { Gifts, Claim } from 'pages/Gift'
import { Subscribe, Subscriptions } from 'pages/Subscriptions'
import Security, { Dapps } from 'pages/Security'
import Profile from 'pages/Profile'

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
            // payments put aside, sent together (utils/send-queue.ts)
            path: 'send-queue',
            name: 'send-queue',
            component: SendQueue
        }, {
            path: 'voter-rewards',
            name: 'voter-rewards',
            component: VoterRewards
        }, {
            path: 'year-review',
            name: 'year-review',
            component: YearReview
        }, {
            path: 'help',
            name: 'help',
            component: Help
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
            path: 'panic',
            name: 'panic',
            component: Panic
        }, {
            path: 'vet-name',
            name: 'vet-name',
            component: VetName
        }, {
            path: 'pos',
            name: 'pos',
            component: Pos
        }, {
            path: 'yield',
            name: 'yield',
            component: Yield
        }, {
            path: 'practice',
            name: 'practice',
            component: Practice
        }, {
            path: 'chat',
            name: 'chat',
            component: Chat
        }, {
            // what a shop's NFC sticker opens
            path: 'tap/:id',
            name: 'tap',
            component: Tap
        }, {
            path: 'shop',
            name: 'shop',
            component: ShopSetup
        }, {
            // a web shop's order (server/src/shop.ts)
            path: 'checkout/:token',
            name: 'checkout',
            component: Checkout
        }, {
            path: 'statement',
            name: 'statement',
            component: Statement
        }, {
            path: 'sign-message',
            name: 'sign-message',
            component: SignMessage
        }, {
            path: 'impact',
            name: 'impact',
            component: Impact
        }, {
            path: 'proposals',
            name: 'proposals',
            component: Proposals
        }, {
            path: 'validators',
            name: 'validators',
            component: Validators
        }, {
            path: 'vtho',
            name: 'vtho-tank',
            component: VthoTank
        }, {
            path: 'gifts',
            name: 'gifts',
            component: Gifts
        }, {
            path: 'invoices',
            name: 'invoices',
            component: Invoices
        }, {
            path: 'donate-button',
            name: 'donate-button',
            component: DonateButton
        }, {
            // a money link: the key rides in the link's query, after the #, never sent to a server
            path: 'claim',
            name: 'claim',
            component: Claim
        }, {
            path: 'subscriptions',
            name: 'subscriptions',
            component: Subscriptions
        }, {
            path: 'subscribe',
            name: 'subscribe',
            component: Subscribe
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
            path: 'walletconnect',
            name: 'walletconnect',
            component: WalletConnect
        }, {
            path: 'stargate',
            name: 'stargate',
            component: Stargate
        }, {
            path: 'vebetter',
            name: 'vebetter',
            component: VeBetter
        }, {
            path: 'discover',
            name: 'discover',
            component: Discover
        }, {
            path: 'vote',
            name: 'vote',
            component: Vote
        }, {
            path: 'leaderboard',
            name: 'leaderboard',
            component: Leaderboard
        }, {
            path: 'listings',
            name: 'listings',
            component: Listings
        }, {
            path: 'offers',
            name: 'offers',
            component: OfferInbox
        }, {
            path: 'pnl',
            name: 'pnl',
            component: Pnl
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
    // a public profile: outside the app's frame, so it opens without a wallet
    {
        path: '/u/:id',
        name: 'profile',
        component: Profile,
        props: true
    },
    // Always leave this as last one
    {
        path: '/:catchAll(.*)*',
        redirect: '/'
    }
]

export default routes
