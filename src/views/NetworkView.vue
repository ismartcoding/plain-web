<template>
  <div class="page-container container">
    <div class="main">
      <breadcrumb :current="() => $t('page_title.network')" />
      <edit-toolbar
        v-model="currentTab"
        :save="save"
        :loading="loading"
        :tabs="['/etc/netplan/config.yaml', '/etc/plainbox/netmix.yaml']"
      />
      <monaco-editor language="yaml" height="700" v-model="netplan" v-show="currentTab === 0" />
      <monaco-editor language="yaml" height="700" v-model="netmix" v-show="currentTab === 1" />
    </div>
  </div>
</template>

<script setup lang="ts">
import gql from 'graphql-tag'
import { networkConfigFragment } from '@/lib/api/fragments'
import { ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { initQuery } from '@/lib/api/query'
import { initMutation } from '@/lib/api/mutation'
const { t } = useI18n()

const currentTab = ref(0)
const netplan = ref('')
const netmix = ref('')

initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      netplan.value = data.networkConfig.netplan
      netmix.value = data.networkConfig.netmix
    }
  },
  document: gql`
    query {
      networkConfig {
        ...NetworkConfigFragment
      }
    }
    ${networkConfigFragment}
  `,
})

const { mutate, loading, onDone } = initMutation({
  document: gql`
    mutation applyNetplanAndNetmix($netplan: String!, $netmix: String!) {
      applyNetplan(config: $netplan) {
        __typename
      }
      applyNetmix(config: $netmix) {
        ...NetworkConfigFragment
      }
    }
    ${networkConfigFragment}
  `,
})

onDone(() => {
  toast(t('saved'))
})

function save() {
  if (!netplan.value || !netmix.value) {
    return
  }
  mutate({
    netplan: netplan.value,
    netmix: netmix.value,
  })
}
</script>
