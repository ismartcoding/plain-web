<template>
  <div class="quick-content-main">
    <div class="top-app-bar">
      <button class="btn-icon" @click.prevent="store.quick = ''" v-tooltip="$t('close')">
        <md-ripple />
        <i-material-symbols:right-panel-close-outline />
      </button>
      <div class="title">{{ $t('header_actions.notifications') }} ({{ notifications.length }})</div>
      <div class="actions">
        <button v-if="notifications.length" class="btn-icon" @click.prevent="clearAll" v-tooltip="$t('clear_list')">
          <md-ripple />
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
      </div>
    </div>
    <div class="alert-warning show" v-if="!isHttps && notifcationPermission !== 'granted'">
      <i-material-symbols:error-outline-rounded />
      <div class="body">{{ $t('desktop_notification_need_https') }}</div>
      <div class="actions">
        <md-filled-button class="btn-sm" @click.stop="useHttpsLink">{{ $t('use_https_link') }}</md-filled-button>
      </div>
    </div>
    <div class="alert-warning show" v-else-if="notifcationPermission !== 'granted'">
      <i-material-symbols:error-outline-rounded />
      <div class="body">{{ $t('desktop_notification_permission_not_granted') }}</div>
      <div class="actions">
        <md-filled-button class="btn-sm" @click.stop="grantPermission">{{ $t('grant_permission') }}</md-filled-button>
      </div>
    </div>
    <div class="quick-content-body">
      <section v-if="notifications.length" class="list-items">
        <div v-for="item in notifications" class="item" :key="item.id">
          <div class="title">
            <popper>
              <img width="20" height="20" :src="item.icon" />
              <template #content>
                <pre class="view-raw">{{ item }}</pre>
              </template>
            </popper>
            <span class="name">{{ item.appName }}</span>
            <time class="time nowrap" v-tooltip="formatDateTimeFull(item.time)">{{ formatDateTime(item.time) }}</time>
          </div>
          <div class="subtitle">{{ item.title }}</div>
          <div class="body">{{ item.body }}</div>
          <button class="btn-icon icon" @click.stop="deleteItem(item)">
            <md-ripple />
            <i-material-symbols:close-rounded />
          </button>
        </div>
      </section>
      <span class="no-data" v-else>
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
import { pushModal } from '@/components/modal'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useMainStore } from '@/stores/main'

const { resolveClient } = useApolloClient()
const store = useMainStore()

const { t } = useI18n()
const { app, urlTokenKey } = storeToRefs(useTempStore())
const notifications = ref<INotification[]>([])
const isHttps = window.location.protocol === 'https:'
const { loading } = initQuery({
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
  appApi: true,
})

const notifcationPermission = ref(Notification.permission)

const { mutate: cancelNotifications } = initMutation({
  document: cancelNotificationsGQL,
  appApi: true,
})

const deleteItem = (item: INotification) => {
  cancelNotifications({ ids: [item.id] })
}

const useHttpsLink = () => {
  window.open(`https://${window.location.hostname}:${app.value.httpsPort}`, '_blank')
}

const grantPermission = () => {
  if (Notification.permission === 'denied') {
    pushModal(ConfirmModal, {
      title: t('desktop_notification_permission_grant_title'),
      message: t('desktop_notification_permission_grant_message'),
    })
    return
  }
  Notification.requestPermission().then((permission) => {
    notifcationPermission.value = permission
  })
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
    if ('Notification' in window) {
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
    if ('Notification' in window) {
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

.alert-warning {
  margin-block-end: 8px;
  margin-inline-end: 8px;
}
</style>
