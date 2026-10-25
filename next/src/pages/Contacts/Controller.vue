<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('contacts.title')">
            <q-btn
                flat
                round
                icon="o_qr_code_2"
                :aria-label="$t('contacts.action_share_qr')"
            >
                <q-menu
                    anchor="bottom right"
                    self="top right"
                >
                    <q-list style="min-width: 220px">
                        <q-item
                            v-close-popup
                            clickable
                            :disable="!contacts.length"
                            @click="shareQr()"
                        >
                            <q-item-section avatar>
                                <q-icon name="o_qr_code_2" />
                            </q-item-section>
                            <q-item-section>{{$t('contacts.action_share_qr')}}</q-item-section>
                        </q-item>
                        <q-item
                            v-close-popup
                            clickable
                            @click="importQr()"
                        >
                            <q-item-section avatar>
                                <q-icon name="o_qr_code_scanner" />
                            </q-item-section>
                            <q-item-section>{{$t('contacts.action_import_qr')}}</q-item-section>
                        </q-item>
                    </q-list>
                </q-menu>
            </q-btn>
            <q-btn
                :aria-label="$t('common.add')"
                flat
                round
                icon="add"
                @click="add()"
            />
        </page-toolbar>
        <page-content
            class="col"
            padding
        >
            <div
                v-if="contacts.length === 0"
                class="bvm-tile q-pa-lg text-center"
            >
                <q-icon
                    name="o_contacts"
                    size="36px"
                    color="primary"
                />
                <p class="text-soft q-mt-sm">{{$t('contacts.msg_empty')}}</p>
                <q-btn
                    unelevated
                    color="primary"
                    icon="add"
                    :label="$t('contacts.title_add')"
                    @click="add()"
                />
            </div>
            <q-list
                v-else
                class="bvm-list"
            >
                <q-item
                    v-for="(c, i) in sorted"
                    :key="c.address + i"
                    clickable
                    @click="edit(c)"
                >
                    <q-item-section avatar>
                        <address-avatar
                            :addr="c.address"
                            size="34px"
                        />
                    </q-item-section>
                    <q-item-section style="min-width: 0">
                        <q-item-label lines="1">{{c.name}}</q-item-label>
                        <q-item-label
                            caption
                            lines="1"
                        >
                            <address-label
                                no-icon
                                :addr="c.address"
                                no-name
                            />
                        </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <q-btn
                            :aria-label="$t('common.delete')"
                            flat
                            round
                            dense
                            icon="o_delete"
                            @click.stop="remove(c)"
                        />
                    </q-item-section>
                </q-item>
            </q-list>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import AddressAvatar from 'components/AddressAvatar.vue'
import AddressLabel from 'components/AddressLabel.vue'
import ContactDialog from './ContactDialog.vue'
import type { Contact } from 'src/utils/names'
import QrScannerDialog from 'pages/QrScannerDialog'
import { decodeContacts, encodeContacts } from 'src/utils/contacts-share'

// the address book: names show up instead of addresses everywhere in the wallet
export default defineComponent({
    components: { PageToolbar, PageContent, AddressAvatar, AddressLabel },
    data: () => ({
        contacts: [] as Contact[]
    }),
    computed: {
        sorted(): Contact[] {
            return [...this.contacts].sort((a, b) => a.name.localeCompare(b.name))
        }
    },
    async created() {
        this.contacts = await this.$svc.config.getContacts()
    },
    methods: {
        async save(list: Contact[]) {
            this.contacts = list
            await this.$svc.config.saveContacts(list)
        },
        async add() {
            try {
                const c = await this.$dialog<Contact>({ component: ContactDialog })
                const rest = this.contacts.filter(x => x.address.toLowerCase() !== c.address.toLowerCase())
                await this.save([...rest, c])
            } catch { }
        },
        async edit(contact: Contact) {
            try {
                const c = await this.$dialog<Contact>({ component: ContactDialog, contact })
                const rest = this.contacts.filter(x => x !== contact && x.address.toLowerCase() !== c.address.toLowerCase())
                await this.save([...rest, c])
            } catch { }
        },
        shareQr() {
            this.$qrcode({
                title: this.$t('contacts.title_qr', { n: this.contacts.length }),
                content: encodeContacts(this.contacts),
                message: this.$t('contacts.msg_qr'),
                messageClass: 'text-center text-muted'
            })
        },
        async importQr() {
            try {
                const text = await this.$dialog<string>({ component: QrScannerDialog })
                const found = decodeContacts(text)
                if (!found) {
                    this.$q.notify(this.$t('contacts.msg_not_contacts'))
                    return
                }
                const known = new Set(this.contacts.map(c => c.address.toLowerCase()))
                const added = found.filter(c => !known.has(c.address.toLowerCase()))
                await this.save([...this.contacts, ...added])
                this.$q.notify(this.$t('contacts.msg_imported', { n: added.length }))
            } catch { }
        },
        async remove(contact: Contact) {
            await this.save(this.contacts.filter(x => x !== contact))
        }
    }
})
</script>
