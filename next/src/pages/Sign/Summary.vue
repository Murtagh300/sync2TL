<template>
    <div>
        <div class="text-center">
            <!-- img loader -->
            <img
                v-if="!!faviconUrl"
                v-show="false"
                :src="faviconUrl"
                @load="iconLoaded=true"
            >

            <!-- favicon -->
            <div class="relative-position favicon-frame q-mx-auto">
                <transition
                    mode="out-in"
                    name="q-transition--fade"
                >
                    <img
                        v-if="iconLoaded"
                        class="fit absolute-full"
                        :src="faviconUrl"
                    >
                    <div
                        v-else
                        class="fit text-h4 text-weight-bolder column justify-center"
                    >{{(host[0]|| '?').toUpperCase()}}</div>
                </transition>
            </div>
            <h1 class="bvm-display summary-title q-mt-lg q-mb-lg">{{$t('sign.msg_request_signature')}}</h1>
        </div>
        <!-- descriptions -->
        <div class="bvm-tile summary-rows">
            <div
                v-for="(item, i) in items"
                :key="i"
                class="summary-row"
            >
                <div class="text-muted summary-caption">{{item.caption}}</div>
                <div class="summary-text">{{item.text}}</div>
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { RelayedRequest } from './models'

type Item = {
    caption: string
    text: string
}

export default defineComponent({
    data: () => {
        return {
            iconLoaded: false
        }
    },
    props: {
        request: { type: Object as () => RelayedRequest, required: true }
    },
    computed: {
        host(): string {
            try {
                return new URL(this.request.origin || '').host
            } catch {
                return ''
            }
        },
        faviconUrl(): string {
            return this.host
                ? `https://api.faviconkit.com/${encodeURIComponent(this.host)}/128`
                : ''
        },
        type(): string {
            switch (this.request.type) {
                case 'tx': return this.$t('common.transaction').toString()
                case 'cert': return this.$t('common.certificate').toString()
                default: return this.$t('common.unknown').toString()
            }
        },
        summary(): Item | null {
            const req = this.request
            if (req.type === 'tx') {
                return {
                    caption: this.$t('sign.label_request_summary').toString(),
                    text: (req.payload as M.TxRequest).options?.comment || 'N/A'
                }
            } else if (req.type === 'cert') {
                const msg = (req.payload as M.CertRequest).message
                switch (msg.purpose) {
                    case 'identification': return {
                        caption: this.$t('sign.label_purpose').toString(),
                        text: this.$t('common.identification').toString()
                    }
                    case 'agreement': return {
                        caption: this.$t('sign.label_purpose').toString(),
                        text: this.$t('common.agreement').toString()
                    }
                    default: return null
                }
            }
            return null
        },
        items(): Array<Item> {
            const items = [{
                caption: this.$t('sign.label_request_from').toString(),
                text: this.request.origin || ''
            }, {
                caption: this.$t('sign.label_request_type').toString(),
                text: this.type
            }]
            this.summary && items.push(this.summary)
            return items
        }
    }
})
</script>
<style lang="sass" scoped>
.favicon-frame
  width: 72px
  height: 72px
  border-radius: 20px
  overflow: hidden
  border: 1px solid $hairline-2
  background: rgba(255, 255, 255, 0.05)

.summary-title
  font-size: 28px

.summary-rows
  text-align: left

.summary-row
  padding: 12px 16px
  & + &
    border-top: 1px solid $hairline

.summary-caption
  font-size: 12px
  font-weight: 700

.summary-text
  font-weight: 700
  word-break: break-word
</style>
