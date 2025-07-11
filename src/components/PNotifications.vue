<template>
  <div class="quick-content-main">
    <div class="top-app-bar">
      <button v-tooltip="$t('close')" class="btn-icon" @click.prevent="store.quick = ''">
        <i-lucide:x />
      </button>
      <div class="title">
        {{ $t('header_actions.notifications') }} ({{ notifications.length }})
        <div v-if="hasNotificationWarning" class="warning-indicator">
          <popper>
            <button class="btn-icon warning-icon">
              <i-material-symbols:warning-outline />
            </button>
            <template #content>
              <div class="warning-dropdown">
                <div class="warning-content">
                  <i-material-symbols:error-outline-rounded />
                  <div class="warning-text">
                    {{ $t(notificationWarningMessage) }}
                  </div>
                </div>
                <div v-if="notificationWarningAction" class="warning-actions">
                  <v-filled-button class="btn-sm" @click="notificationWarningAction.action()">
                    {{ $t(notificationWarningAction.text) }}
                  </v-filled-button>
                </div>
              </div>
            </template>
          </popper>
        </div>
      </div>
      <div class="actions">
        <button v-if="notifications.length" v-tooltip="$t('clear_list')" class="btn-icon" @click.prevent="clearAll">
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
      </div>
    </div>

    <div class="quick-content-body">
      <section v-if="notifications.length" class="list-items">
        <div v-for="item in notifications" :key="item.id" class="item">
          <div class="title">
            <popper>
              <img width="20" height="20" :src="item.icon" />
              <template #content>
                <pre class="view-raw">{{ item }}</pre>
              </template>
            </popper>
            <span class="name">{{ item.appName }}</span>
            <time v-tooltip="formatDateTimeFull(item.time)" class="time nowrap">{{ formatDateTime(item.time) }}</time>
          </div>
          <div class="subtitle">{{ item.title }}</div>
          <div class="body">{{ item.body }}</div>
          <button class="btn-icon icon" @click.stop="deleteItem(item)">
            
            <i-material-symbols:close-rounded />
          </button>
        </div>
      </section>
      <span v-else class="no-data">
        {{ $t(noDataKey(loading, app.permissions, 'NOTIFICATION_LISTENER')) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { initQuery, notificationsGQL } from '@/lib/api/query'
import { initMutation, insertCache, cancelNotificationsGQL } from '@/lib/api/mutation'
import toast from '@/components/toaster'
import type { INotification } from '@/lib/interfaces'
import { useI18n } from 'vue-i18n'
import { noDataKey } from '@/lib/list'
import { getFileUrlByPath } from '@/lib/api/file'
import emitter from '@/plugins/eventbus'
import { useApolloClient } from '@vue/apollo-composable'
import { useMainStore } from '@/stores/main'
import { useNotificationWarning } from '@/hooks/notification-warning'

const { resolveClient } = useApolloClient()
const store = useMainStore()

const { t } = useI18n()
const { app, urlTokenKey } = storeToRefs(useTempStore())

// Notification warning
const { hasWarning: hasNotificationWarning, warningMessage: notificationWarningMessage, warningAction: notificationWarningAction } = useNotificationWarning()
const notifications = ref<INotification[]>([])
const { loading, refetch } = initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        notifications.value = data.notifications.map((it: any) => ({
          ...it,
          icon: getFileUrlByPath(urlTokenKey.value, 'pkgicon://' + it.appId),
        }))
      }
    }
  },
  document: notificationsGQL,
})

const { mutate: cancelNotifications } = initMutation({
  document: cancelNotificationsGQL,
})

const deleteItem = (item: INotification) => {
  cancelNotifications({ ids: [item.id] })
}

const clearAll = () => {
  const ids = notifications.value.map((it) => it.id)
  cancelNotifications({ ids })
}

onMounted(() => {
  emitter.on('notification_created', async (data: INotification) => {
    const client = resolveClient('a')
    insertCache(client.cache, [{ ...data, __typename: 'Notification' }], notificationsGQL, null, true)
    data.icon = getFileUrlByPath(urlTokenKey.value, 'pkgicon://' + data.appId)
    if ('Notification' in window && typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        const notification = new Notification(data.title, {
          body: data.body,
          icon: data.icon,
        })
        notification.onclick = () => {
          window.focus()
          notification.close()
        }
      }
    }
  })

  emitter.on('notification_updated', async (data: INotification) => {
    const client = resolveClient('a')
    const cache = client.cache
    cache.evict({ id: cache.identify({ __typename: 'Notification', id: data.id }) })
    insertCache(cache, [{ ...data, __typename: 'Notification' }], notificationsGQL, null, true)
    data.icon = getFileUrlByPath(urlTokenKey.value, 'pkgicon://' + data.appId)
    if ('Notification' in window && typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        const notification = new Notification(data.title, {
          body: data.body,
          icon: data.icon,
        })
        notification.onclick = () => {
          window.focus()
          notification.close()
        }
      }
    }
  })

  emitter.on('notification_deleted', async (data: INotification) => {
    const client = resolveClient('a')
    const cache = client.cache
    cache.evict({ id: cache.identify({ __typename: 'Notification', id: data.id }) })
  })

  emitter.on('notification_refreshed', async () => {
    refetch()
  })
})
</script>

<style lang="scss" scoped>
.list-items {
  .item:first-child {
    margin-block-start: 8px;
  }

  .item:last-child {
    margin-block-end: 8px;
  }

  .title img {
    margin-inline-end: 8px;
  }

  .time {
    color: var(--md-sys-color-secondary);
    font-size: 0.75rem;
    margin-inline-start: 8px;
    word-break: keep-all;
    white-space: nowrap;
  }

  .name {
    word-break: keep-all;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}
</style>
