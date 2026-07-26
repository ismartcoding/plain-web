<template>
  <div class="quick-content-main">
    <div class="top-app-bar">
      <button v-tooltip="$t('close')" class="btn-icon" @click.prevent="store.quick = ''">
        <i-material-symbols:arrow-back-rounded />
      </button>
      <div class="title">
        {{ $t('header_actions.notifications') }} ({{ notifications.length }})
        <div v-if="hasNotificationWarning" class="warning-indicator">
          <v-dropdown v-model="warningMenuVisible">
            <template #trigger>
              <button class="btn-icon warning-icon">
                <i-material-symbols:warning-outline />
              </button>
            </template>
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
          </v-dropdown>
        </div>
      </div>
      <div class="actions">
        <notification-sound-button v-model="notificationVolume" />
        <button v-if="notifications.length" v-tooltip="$t('clear_list')" class="btn-icon" @click.prevent="clearAll">
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
      </div>
    </div>

    <div class="quick-content-body">
      <section v-if="notifications.length" class="list-items">
        <div v-for="item in notifications" :key="item.id" class="item">
          <div class="title">
            <v-dropdown :model-value="openIconId === item.id" @update:model-value="(v: boolean) => openIconId = v ? item.id : ''">
              <template #trigger>
                <img width="20" height="20" :src="item.icon" />
              </template>
              <pre class="view-raw">{{ item }}</pre>
            </v-dropdown>
            <span class="name">{{ item.appName }}</span>
            <time v-tooltip="formatDateTimeFull(item.time)" class="time nowrap">{{ formatDateTime(item.time) }}</time>
          </div>
          <div class="subtitle">{{ item.title }}</div>
          <div class="body">{{ item.body }}</div>
          <div v-if="item.replyActions && item.replyActions.length && replyingId !== item.id" class="reply-actions">
            <v-outlined-button
              v-for="(label, idx) in item.replyActions"
              :key="idx"
              class="btn-sm"
              @click.stop="startReply(item.id, idx)"
            >
              {{ label }}
            </v-outlined-button>
          </div>
          <div v-if="replyingId === item.id" class="reply-box">
            <v-text-field v-model="replyText" type="textarea" :rows="2" :placeholder="$t('type_a_reply')" />
            <div class="reply-box-actions">
              <v-outlined-button class="btn-sm" @click.stop="cancelReply">Cancel</v-outlined-button>
              <v-filled-button class="btn-sm" :loading="replySending" :disabled="!replyText.trim()" @click.stop="sendReply(item.id)">Send</v-filled-button>
            </div>
          </div>
          <button class="btn-icon icon" @click.stop="deleteItem(item)">
            <i-material-symbols:close-rounded />
          </button>
        </div>
      </section>
      <NoDataPlaceholder v-else :loading="loading" :permissions="app.permissions" permission="NOTIFICATION_LISTENER" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import NoDataPlaceholder from '@/components/NoDataPlaceholder.vue'
import NotificationSoundButton from '@/components/NotificationSoundButton.vue'
import { useNotifications } from './notifications'

const warningMenuVisible = ref(false)
const openIconId = ref('')

const {
  store, app, notificationVolume, notifications, loading,
  hasNotificationWarning, notificationWarningMessage, notificationWarningAction,
  replyingId, replyText, replySending,
  startReply, cancelReply, sendReply, deleteItem, clearAll,
} = useNotifications()
</script>

<style lang="scss" scoped>
.list-items {
  .item {
    grid-template-areas:
      'title icon'
      'subtitle icon'
      'body body'
      'reply-actions reply-actions'
      'reply-box reply-box';
  }

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

  .reply-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .reply-box {
    grid-area: reply-box;
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .reply-box-actions {
    grid-area: reply-actions;
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
}
</style>
