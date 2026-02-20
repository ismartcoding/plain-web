<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <li :class="{ active: currentId === 'local' }" @click.prevent="openChat('local')">
          <span class="icon" aria-hidden="true"><i-lucide:bot /></span>
          <span class="title">{{ $t('page_title.local_chat') }}</span>
        </li>
      </ul>

      <template v-if="loading">
        <div class="sidebar-loading">
          <v-circular-progress indeterminate class="sm" />
        </div>
      </template>
      <template v-else>
        <template v-if="pairedPeers.length > 0">
          <div class="section-title">{{ $t('paired_devices') }}</div>
          <ul class="nav">
            <li
              v-for="peer in pairedPeers"
              :key="peer.id"
              :class="{ active: currentId === 'peer:' + peer.id }"
              @click.prevent="openChat('peer:' + peer.id)"
            >
              <span class="icon" aria-hidden="true">
                <i-lucide:smartphone v-if="peer.deviceType === 'phone'" />
                <i-lucide:tablet v-else-if="peer.deviceType === 'tablet'" />
                <i-lucide:laptop v-else-if="peer.deviceType === 'pc'" />
                <i-lucide:monitor v-else />
              </span>
              <span class="title">{{ peer.name }}</span>
              <span class="subtitle">{{ peer.ip }}</span>
            </li>
          </ul>
        </template>

        <template v-if="unpairedPeers.length > 0">
          <div class="section-title">{{ $t('unpaired_devices') }}</div>
          <ul class="nav">
            <li
              v-for="peer in unpairedPeers"
              :key="peer.id"
              :class="{ active: currentId === 'peer:' + peer.id }"
              @click.prevent="openChat('peer:' + peer.id)"
            >
              <span class="icon" aria-hidden="true">
                <i-lucide:smartphone v-if="peer.deviceType === 'phone'" />
                <i-lucide:tablet v-else-if="peer.deviceType === 'tablet'" />
                <i-lucide:laptop v-else-if="peer.deviceType === 'pc'" />
                <i-lucide:monitor v-else />
              </span>
              <span class="title">{{ peer.name }}</span>
              <span class="subtitle">{{ peer.ip }}</span>
            </li>
          </ul>
        </template>
      </template>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/stores/main'
import { replacePath } from '@/plugins/router'
import { initLazyQuery, peersGQL } from '@/lib/api/query'
import type { IPeer } from '@/lib/interfaces'
import { ref } from 'vue'

const router = useRouter()
const mainStore = useMainStore()
const peers = ref<IPeer[]>([])

const currentId = computed(() => {
  return router.currentRoute.value.params.id as string | undefined
})

const pairedPeers = computed(() => peers.value.filter((p) => p.status === 'paired'))
const unpairedPeers = computed(() => peers.value.filter((p) => p.status !== 'paired'))

const { fetch, loading } = initLazyQuery({
  handle: (data: { peers: IPeer[] }) => {
    if (data?.peers) {
      peers.value = data.peers
    }
  },
  document: peersGQL,
  variables: () => ({}),
})

function openChat(id: string) {
  replacePath(mainStore, `/chat/${id}`)
}

fetch()
</script>

<style lang="scss" scoped>
.sidebar-loading {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.subtitle {
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
