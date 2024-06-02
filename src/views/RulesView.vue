<template>
  <div class="top-app-bar">
    <div class="title">{{ $t('page_title.rules') }}</div>
  </div>
  <div class="top-app-bar">
    <div class="title">{{ $t('page_title.rules') }}</div>
    <div class="actions">
      <button type="button" class="btn" @click="create">
        {{ $t('create') }}
      </button>
    </div>
  </div>
  <div class="table-responsive">
    <table class="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>{{ $t('apply_to') }}</th>
          <th>{{ $t('description') }}</th>
          <th>{{ $t('notes') }}</th>
          <th>{{ $t('enabled') }}</th>
          <th>{{ $t('created_at') }}</th>
          <th>{{ $t('updated_at') }}</th>
          <th class="actions two">{{ $t('actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td>
            <field-id :id="item.id" :raw="item.data" />
          </td>
          <td>{{ item.applyTo.getText($t, devices, networks) }}</td>
          <td>
            {{
              $t(`rule_${item.data.direction}`, {
                action: $t(item.data.action),
                target: item.target.getText($t, networks),
              })
            }}
          </td>
          <td>{{ item.data.notes }}</td>
          <td>
            <div class="form-check">
              <md-checkbox touch-target="wrapper" :disabled="enableLoading" @change="enable(item)" :checked="item.data.is_enabled" />
            </div>
          </td>
          <td class="nowrap">
            <time v-tooltip="formatDateTimeFull(item.createdAt)">
              {{ formatDateTime(item.createdAt) }}
            </time>
          </td>
          <td class="nowrap">
            <time v-tooltip="formatDateTimeFull(item.updatedAt)">
              {{ formatDateTime(item.updatedAt) }}
            </time>
          </td>
          <td class="actions two">
            <a href="#" class="v-link" @click.prevent="edit(item)">{{ $t('edit') }}</a>
            <a href="#" class="v-link" @click.prevent="deleteItem(item)">{{ $t('delete') }}</a>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import gql from 'graphql-tag'
import { configFragment, deviceFragment, networkFragment } from '@/lib/api/fragments'
import { initQuery } from '@/lib/api/query'
import { ApplyTo } from '@/lib/apply-to'
import { Target } from '@/lib/target'
import { ref } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { initMutation } from '@/lib/api/mutation'
import { useI18n } from 'vue-i18n'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import EditRuleModal from '@/components/EditRuleModal.vue'

const items = ref<any[]>([])
const devices = ref<any[]>([])
const networks = ref<any[]>([])
const { t } = useI18n()

initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      items.value = data.configs
        .filter((it: { group: string }) => it.group === 'rule')
        .map((it: any) => {
          const c = JSON.parse(it.value)
          const applyTo = new ApplyTo()
          applyTo.parse(c.apply_to)
          const target = new Target()
          target.parse(c.target)
          return {
            id: it.id,
            createdAt: it.createdAt,
            updatedAt: it.updatedAt,
            data: c,
            applyTo,
            target,
          }
        })
      devices.value = [...data.devices]
      networks.value = [...data.networks]
    }
  },
  document: gql`
    query {
      configs {
        ...ConfigFragment
      }
      devices {
        ...DeviceFragment
      }
      networks {
        ...NetworkFragment
      }
    }
    ${deviceFragment}
    ${configFragment}
    ${networkFragment}
  `,
})

const deleteGQL = gql`
  mutation DeleteConfig($id: ID!) {
    deleteConfig(id: $id)
  }
`

function deleteItem(item: any) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: item.id,
    gql: deleteGQL,
    appApi: false,
    typeName: 'Config',
  })
}

function edit(item: any) {
  openModal(EditRuleModal, {
    data: item,
    devices: devices,
    networks: networks,
  })
}
function create() {
  openModal(EditRuleModal, {
    data: null,
    devices: devices,
    networks: networks,
  })
}

const { mutate: enableMutate, loading: enableLoading } = initMutation({
  document: gql`
    mutation updateConfig($id: ID!, $input: ConfigInput!) {
      updateConfig(id: $id, input: $input) {
        ...ConfigFragment
      }
    }
    ${configFragment}
  `,
})

function enable(item: any) {
  enableMutate({ id: item.id, input: { group: 'rule', value: JSON.stringify(item.data) } })
}
</script>
