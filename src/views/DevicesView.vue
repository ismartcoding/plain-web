<template>
  <div class="page-container container">
    <div class="main">
      <breadcrumb :current="() => $t('page_title.devices')" />
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>{{ $t('name') }}</th>
            <th>{{ $t('ip_address') }}</th>
            <th>{{ $t('mac_address') }}</th>
            <th>{{ $t('manufacturer') }}</th>
            <th>{{ $t('status') }}</th>
            <th>{{ $t('created_at') }}</th>
            <th>{{ $t('active_at') }}</th>
            <th class="actions one">{{ $t('actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>
              <field-id :id="item.id" :raw="item" />
            </td>
            <td>
              <a href="#" @click.prevent="rename(item)">{{ item.name ? item.name : $t('unknown') }}</a>
            </td>
            <td>{{ item.ip4 }}</td>
            <td>{{ item.mac.toUpperCase() }}</td>
            <td>{{ item.macVendor ? item.macVendor : $t('unknown') }}</td>
            <td>{{ $t(item.isOnline ? 'online' : 'offline') }}</td>
            <td class="nowrap" :title="formatDateTimeFull(item.createdAt)">{{ formatDateTime(item.createdAt) }}</td>
            <td class="nowrap" :title="formatDateTimeFull(item.activeAt)">{{ formatDateTime(item.activeAt) }}</td>
            <td class="actions one">
              <a href="#" class="v-link" @click.prevent="deleteItem(item)">{{ $t('delete') }}</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import gql from 'graphql-tag'
import { deviceFragment } from '@/lib/api/fragments'
import { initQuery } from '@/lib/api/query'
import { ref } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { initMutation } from '@/lib/api/mutation'
import { useI18n } from 'vue-i18n'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import EditValueModal from '@/components/EditValueModal.vue'

const { t } = useI18n()
const items = ref<any[]>([])

initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      items.value = [...data.devices]
    }
  },
  document: gql`
    query {
      devices {
        ...DeviceFragment
      }
    }
    ${deviceFragment}
  `,
})

function deleteItem(item: any) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: item.name || t('unknown'),
    gql: gql`
      mutation DeleteDevice($id: ID!) {
        deleteDevice(id: $id)
      }
    `,
    appApi: false,
    typeName: 'Device',
  })
}

function rename(item: any) {
  openModal(EditValueModal, {
    title: t('rename'),
    placeholder: t('name'),
    mutation: () =>
      initMutation({
        document: gql`
          mutation updateDeviceName($id: ID!, $name: String!) {
            updateDeviceName(id: $id, name: $name) {
              ...DeviceFragment
            }
          }
          ${deviceFragment}
        `,
        appApi: false,
      }),
    value: item.name ? item.name : t('unknown'),
    getVariables: (value: string) => {
      return { id: item.id, name: value }
    },
  })
}
</script>
