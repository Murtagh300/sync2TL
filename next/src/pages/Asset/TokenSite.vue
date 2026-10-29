<template>
    <div
        v-if="!token.permanent"
        class="q-mx-md q-mt-md"
    >
        <div class="row items-center q-gutter-xs">
            <q-chip
                dense
                outline
                class="q-ml-none"
                icon="o_category"
                :label="$t(`tokenCat.${category}`)"
            />
            <q-chip
                v-if="token.custom"
                dense
                outline
                color="warning"
                icon="o_report_gmailerrorred"
                :label="$t('tokens.badge_custom')"
            />
        </div>
        <template v-if="links.length">
            <q-btn
                v-if="site"
                unelevated
                no-caps
                color="primary"
                class="full-width q-mt-sm"
                icon="o_language"
                icon-right="o_open_in_new"
                :label="label ? $t('tokenSite.action_site_named', { name: label }) : $t('tokenSite.action_site', { host: host(site.url) })"
                @click="openURL(site.url)"
            />
            <div
                v-if="socials.length"
                class="row q-gutter-sm q-mt-sm"
            >
                <q-btn
                    v-for="l in socials"
                    :key="l.kind"
                    outline
                    dense
                    no-caps
                    size="sm"
                    class="q-px-sm"
                    :icon="icons[l.kind]"
                    :label="$t(`tokenSite.link_${l.kind}`)"
                    @click="openURL(l.url)"
                />
            </div>
        </template>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { siteLabel, tokenCategory, tokenLinks, type TokenCategory, type TokenLink } from 'src/utils/token-meta'
import { openURL } from 'src/utils/open-url'

// what a token is and its own website: the registry's links, or the project's own page (SHA)
export default defineComponent({
    props: {
        token: { type: Object as () => M.TokenSpec, required: true }
    },
    data: () => ({
        icons: { twitter: 'o_alternate_email', telegram: 'o_send', discord: 'o_forum', medium: 'o_article', github: 'o_code' } as Record<string, string>
    }),
    computed: {
        category(): TokenCategory {
            return tokenCategory(this.token)
        },
        links(): TokenLink[] {
            return tokenLinks(this.token)
        },
        site(): TokenLink | undefined {
            return this.links.find(l => l.kind === 'website')
        },
        socials(): TokenLink[] {
            return this.links.filter(l => l.kind !== 'website')
        },
        label(): string {
            return siteLabel(this.token.address)
        }
    },
    methods: {
        openURL,
        host(url: string) {
            try {
                return new URL(url).host.replace(/^www\./, '')
            } catch {
                return url
            }
        }
    }
})
</script>
