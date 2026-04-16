<template>
  <v-modal @close="cancel">
    <template #headline>
      {{ pendingFiles.length > 0 ? $t('send_mms') : $t('send_sms') }}
    </template>
    <template #content>
      <div class="form-row phone-field-wrapper" ref="phoneFieldRef">
        <v-text-field
          ref="numberRef"
          v-model="number"
          type="tel"
          :label="$t('phone_number')"
          :error="!!errors.number"
          :error-text="errors.number ? $t(errors.number) : ''"
          @input="onNumberInput"
          @focus="onNumberFocus"
        >
          <template #trailing-icon>
            <v-icon-button v-tooltip="$t('select_contact')" @click.prevent="toggleContactPicker">
              <i-material-symbols:contact-page-outline-rounded />
            </v-icon-button>
          </template>
        </v-text-field>
        <div v-if="selectedContactName" class="selected-contact-hint">
          <i-material-symbols:person-outline-rounded />
          <span>{{ selectedContactName }}</span>
          <v-icon-button class="clear-contact" @click="clearSelectedContact">
            <i-material-symbols:close-rounded />
          </v-icon-button>
        </div>
        <div v-if="showContactPicker" class="contact-dropdown">
          <div v-if="contactsLoading" class="contact-dropdown-loading">
            <v-circular-progress indeterminate class="sm" />
          </div>
          <template v-else>
            <div class="contact-dropdown-list">
              <template v-for="contact in filteredContacts" :key="contact.id">
                <div
                  v-for="(phone, pi) in contact.phoneNumbers"
                  :key="pi"
                  class="contact-dropdown-item"
                  @click="selectContactNumber(phone.normalizedNumber || phone.value, contact)"
                >
                  <div class="contact-dropdown-info">
                    <span class="contact-dropdown-name">{{ getContactFullName(contact) }}</span>
                    <span v-if="contact.phoneNumbers.length > 1" class="contact-dropdown-type">
                      {{ phone.type > 0 ? $t(`contact.phone_number_type.${phone.type}`) : '' }}
                    </span>
                  </div>
                  <span class="contact-dropdown-number">{{ phone.normalizedNumber || phone.value }}</span>
                </div>
              </template>
              <div v-if="filteredContacts.length === 0" class="contact-dropdown-empty">
                {{ $t('no_data') }}
              </div>
            </div>
          </template>
        </div>
      </div>
      <div class="form-row">
        <v-text-field v-model="body" type="textarea" :rows="4" :label="$t('content')" :error="!!errors.body && pendingFiles.length === 0" :error-text="errors.body && pendingFiles.length === 0 ? $t(errors.body) : ''" />
      </div>
      <div class="form-row">
        <input ref="fileInputRef" type="file" multiple accept="image/*,video/*,audio/*" class="hidden-file-input" @change="onFileSelected" />
        <v-outlined-button @click="openFilePicker">
          <i-material-symbols:attach-file-rounded />
          {{ $t('attachments') }}
        </v-outlined-button>
        <div v-if="pendingFiles.length" class="attachment-list">
          <div v-for="(file, idx) in pendingFiles" :key="idx" class="attachment-item">
            <img v-if="file.type.startsWith('image/')" :src="filePreviewUrl(file)" class="attachment-thumb" />
            <i-material-symbols:attach-file-rounded v-else />
            <span class="attachment-name">{{ file.name }}</span>
            <span class="attachment-size" :class="{ warn: !file.type.startsWith('image/') && file.size > MMS_WARN_SIZE }">{{ formatFileSize(file.size) }}</span>
            <v-icon-button class="attachment-remove" @click="removePendingFile(idx)">
              <i-material-symbols:close-rounded />
            </v-icon-button>
          </div>
          <div v-if="hasLargeNonImageFile" class="attachment-warning">
            <i-material-symbols:warning-outline-rounded />
            {{ $t('mms_large_file_warning') }}
          </div>
          <div v-else-if="totalPendingSize > MMS_WARN_SIZE" class="attachment-hint">
            {{ $t('mms_image_auto_compress') }}
          </div>
        </div>
      </div>
    </template>
    <template #actions>
      <v-outlined-button value="cancel" @click="cancel">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button value="send" :loading="loading || mmsLoading || mmsUploading" @click="submit">
        {{ $t('send') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { useSendSms, MMS_WARN_SIZE } from '@/hooks/send-sms'

const props = defineProps({
  number: { type: String, default: '' },
  body: { type: String, default: '' },
})

const {
  number, body, errors, pendingFiles, fileInputRef, mmsUploading, numberRef,
  showContactPicker, selectedContactName, phoneFieldRef, filteredContacts, contactsLoading,
  loading, mmsLoading, totalPendingSize, hasLargeNonImageFile,
  cancel, submit, toggleContactPicker, onNumberInput, onNumberFocus,
  selectContactNumber, clearSelectedContact, openFilePicker, onFileSelected,
  removePendingFile, filePreviewUrl, getContactFullName, formatFileSize,
} = useSendSms(props.number, props.body)
</script>

<style scoped lang="scss">
.form-row {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.hidden-file-input {
  display: none;
}

.attachment-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--md-sys-color-surface-container-high);
  border-radius: 8px;
}

.attachment-thumb {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.attachment-name {
  flex: 1;
  font-size: 0.8125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.attachment-remove {
  flex-shrink: 0;
}

.attachment-size {
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
  &.warn {
    color: var(--md-sys-color-error);
    font-weight: 500;
  }
}

.attachment-warning {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--md-sys-color-error);
  padding: 4px 0;
}

.attachment-hint {
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
  padding: 4px 0;
}

.phone-field-wrapper {
  position: relative;
}

.selected-contact-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 2px 4px;
  font-size: 0.8125rem;
  color: var(--md-sys-color-primary);

  span {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .clear-contact {
    --md-icon-button-icon-size: 16px;
    --md-icon-button-state-layer-height: 24px;
    --md-icon-button-state-layer-width: 24px;
    flex-shrink: 0;
  }
}

.contact-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  z-index: 10;
  margin-top: -8px;
  background: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.contact-dropdown-loading {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.contact-dropdown-list {
  max-height: 240px;
  overflow-y: auto;
  padding: 4px 0;
}

.contact-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--md-sys-color-surface-container-high);
  }
}

.contact-dropdown-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.contact-dropdown-name {
  font-size: 0.875rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-dropdown-type {
  font-size: 0.6875rem;
  color: var(--md-sys-color-on-surface-variant);
}

.contact-dropdown-number {
  font-size: 0.8125rem;
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.contact-dropdown-empty {
  padding: 20px;
  text-align: center;
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
}
</style>
