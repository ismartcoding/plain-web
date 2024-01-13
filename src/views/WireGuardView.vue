<template>
  <div class="page-container">
    <div class="main">
      <breadcrumb :current="() => $t('page_title.wireguard')" />
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{{ $t('name') }}</th>
              <th>{{ $t('address') }}</th>
              <th>{{ $t('status') }}</th>
              <th>{{ $t('enabled') }}</th>
              <th class="actions two">{{ $t('actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td><field-id :id="item.id" :raw="item" /></td>
              <td>{{ item.wgInterface?.name }}</td>
              <td>{{ item.wgInterface?.address?.join(', ') }}</td>
              <td>
                {{ item.isActive ? $t('running') + ` (${t('listening_port')}: ${item.listeningPort})` : $t('stopped') }}
              </td>
              <td>
                <div class="form-check">
                  <md-checkbox touch-target="wrapper" :disabled="enableLoading" @change="enableWireGuard(item)" :checked="item.isEnabled" />
                </div>
              </td>
              <td class="actions two">
                <a href="#" class="v-link" @click.prevent="edit(item.id)">{{ $t('edit') }}</a>
                <a href="#" class="v-link" @click.prevent="deleteItem(item)">{{ $t('delete') }}</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import gql from 'graphql-tag'
import { wgFragment } from '@/lib/api/fragments'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { parseConfigString } from '@/lib/wireguard/parser'
import { initQuery } from '@/lib/api/query'
import { ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { initMutation } from '@/lib/api/mutation'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'

const store = useMainStore()
const items = ref<any[]>([])
const { t } = useI18n()

function edit(id: string) {
  replacePath(store, `/wireguard/${id}`)
}

initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      items.value = data.wireGuards.map((it: any) => ({
        ...it,
        ...parseConfigString(it.config),
      }))
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

const { mutate: enableMutate, loading: enableLoading } = initMutation({
  document: gql`
    mutation enableWireGuard($id: ID!, $enable: Boolean!) {
      enableWireGuard(id: $id, enable: $enable) {
        ...WireGuardFragment
      }
    }
    ${wgFragment}
  `,
})

function enableWireGuard(item: any) {
  enableMutate({
    id: item.id,
    enable: item.isEnabled,
  })
}

function deleteItem(item: any) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: item.wgInterface?.name,
    gql: gql`
      mutation DeleteWireGuard($id: ID!) {
        deleteWireGuard(id: $id)
      }
    `,
    appApi: false,
    typeName: 'WireGuard',
  })
}
</script>
