<template>
  <breadcrumb :paths="['/wireguard']" :current="name" />
  <edit-toolbar v-model="currentTab" :save="save" :loading="loading" :tabs="[`/etc/wireguard/${id}.conf`]" />
  <monaco-editor language="ini" height="700" v-model="config" :actions="actions" />
</template>

<script setup lang="ts">
import gql from 'graphql-tag'
import { wgFragment } from '@/lib/api/fragments'
import { useRoute } from 'vue-router'
import { ref } from 'vue'
import { generateConfigString, parseConfigString } from '@/lib/wireguard/parser'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { initQuery } from '@/lib/api/query'
import { initMutation } from '@/lib/api/mutation'
import { generateKeypair } from '@/lib/wireguard/wireguard'

const { t } = useI18n()

const currentTab = ref(0)
const route = useRoute()
const id = route.params.id
const config = ref('')
const name = ref('')
const isEnabled = ref(false)

const actions = [
  {
    id: 'add-peer',
    label: 'Add peer',
    precondition: null,
    keybindingContext: null,
    contextMenuGroupId: 'navigation',
    contextMenuOrder: 0,
    run: function () {
      const parsed = parseConfigString(config.value)
      parsed.wgInterface.table = 'off' // disable table routing
      const ip = parsed.wgInterface.address?.[0] ?? ''
      const key = generateKeypair()
      const peerSize = parsed.peers.length
      parsed.peers.push({
        name: `Peer ${peerSize + 1}`,
        allowedIps: [ip.substring(0, ip.lastIndexOf('.')) + `.${peerSize + 2}/32`],
        privateKey: key.privateKey,
        publicKey: key.publicKey,
      })
      config.value = generateConfigString(parsed)
    },
  },
]

initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      const a = data.wireGuards.find((it: { id: string }) => it.id === id)
      if (a) {
        config.value = a.config
        const parsed = parseConfigString(a.config)
        name.value = parsed?.wgInterface.name ?? ''
        isEnabled.value = a.isEnabled
      }
    }
  },
  document: gql`
    query {
      wireGuards {
        ...WireGuardFragment
      }
    }
    ${wgFragment}
  `,
})

const { mutate, loading, onDone } = initMutation({
  document: gql`
    mutation applyWireGuard($id: ID!, $config: String!, $enable: Boolean!) {
      applyWireGuard(id: $id, config: $config, enable: $enable) {
        ...WireGuardFragment
      }
    }
    ${wgFragment}
  `,
})

onDone(() => {
  toast(t('saved'))
})

const save = async () => {
  if (!config.value) {
    return
  }

  const parsed = parseConfigString(config.value)
  parsed.wgInterface.table = 'off' // disable table routing
  config.value = generateConfigString(parsed)

  mutate({
    id,
    config: config.value,
    enable: isEnabled.value,
  })
}
</script>
