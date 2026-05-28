<template>
  <Teleport v-if="isActive" to="#header-end-slot" defer>
    <v-dropdown v-if="dataStorePath" v-model="pathOpen">
      <template #trigger>
        <v-icon-button>
          <i-lucide:info />
        </v-icon-button>
      </template>
      <section class="card card-info">
        <div class="key-value vertical">
          <div class="key">{{ $t('path') }}</div>
          <div class="value">{{ dataStorePath }}</div>
        </div>
      </section>
    </v-dropdown>
    <v-icon-button v-tooltip="$t('refresh')" :loading="loading" @click="refetch">
      <i-material-symbols:refresh-rounded />
    </v-icon-button>
  </Teleport>
  <div class="scroll-content">
    <div v-if="loading" class="state-wrap">
      <v-circular-progress indeterminate />
    </div>
    <dev-data-table
      v-else-if="entries.length > 0"
      :columns="['key', 'value']"
      :rows="entries"
      row-key="key"
      :debug="app.debug"
      :deleting-key="deletingKey"
      @delete="deleteEntry"
    />
    <div v-else class="state-wrap">
      <i-lucide:archive class="state-icon" />
      <span class="state-text">{{ $t('no_data') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onActivated, onDeactivated } from 'vue'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { initQuery, dataStoreEntriesGQL, dataStorePathGQL } from '@/lib/api/query'
import { initMutation, deleteDataStoreEntryGQL } from '@/lib/api/mutation'
import DevDataTable from './DevDataTable.vue'

const isActive = ref(false)
onActivated(() => { isActive.value = true })
onDeactivated(() => { isActive.value = false })

const { app } = storeToRefs(useTempStore())

interface KeyValuePair {
  key: string
  value: string
}

const entries = ref<KeyValuePair[]>([])
const deletingKey = ref('')
const dataStorePath = ref('')
const pathOpen = ref(false)

initQuery({
  handle(data: { dataStorePath: string }, error: string) {
    if (!error && data?.dataStorePath) dataStorePath.value = data.dataStorePath
  },
  document: dataStorePathGQL,
})

const { loading, refetch } = initQuery({
  handle(data: { dataStoreEntries: KeyValuePair[] }, error: string) {
    if (!error) {
      entries.value = data?.dataStoreEntries ?? []
    }
  },
  document: dataStoreEntriesGQL,
})

const { mutate: deleteMutate } = initMutation({ document: deleteDataStoreEntryGQL })

async function deleteEntry(key: string) {
  deletingKey.value = key
  await deleteMutate({ key })
  deletingKey.value = ''
  refetch()
}
</script>

<style lang="scss" scoped>
.scroll-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.state-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 200px;
  color: var(--md-sys-color-on-surface-variant);

  .state-icon {
    width: 40px;
    height: 40px;
    opacity: 0.5;
  }

  .state-text {
    font-size: 0.875rem;
  }
}
</style>

