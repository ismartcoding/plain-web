<template>
  <v-modal @close="cancel">
    <template #headline>
      {{ pendingFiles.length > 0 ? $t('send_mms') : $t('send_sms') }}
    </template>
    <template #content>
      <div class="form-row">
        <ContactPickerDropdown
          v-model="showContactPicker"
          :contacts="filteredContacts"
          :loading="contactsLoading"
          @select="selectContactNumber"
        >
          <template #default="{ toggle }">
            <v-text-field
              ref="numberRef"
              v-model="number"
              type="tel"
              :label="$t('phone_number')"
              :error="!!errors.number"
              :error-text="errors.number ? $t(errors.number) : ''"
              @input="onNumberInput"
              @focus="onNumberFocus"
            />
          </template>
        </ContactPickerDropdown>
        <div v-if="selectedContactName" class="selected-contact-hint">
          <i-material-symbols:person-outline-rounded />
          <span>{{ selectedContactName }}</span>
          <v-icon-button class="clear-contact" @click="clearSelectedContact">
            <i-material-symbols:close-rounded />
          </v-icon-button>
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
import ContactPickerDropdown from '@/components/ContactPickerDropdown.vue'

const props = defineProps({
  number: { type: String, default: '' },
  body: { type: String, default: '' },
})

const {
  number, body, errors, pendingFiles, fileInputRef, mmsUploading, numberRef,
  showContactPicker, selectedContactName, filteredContacts, contactsLoading,
  loading, mmsLoading, totalPendingSize, hasLargeNonImageFile,
  cancel, submit, onNumberInput, onNumberFocus,
  selectContactNumber, clearSelectedContact, openFilePicker, onFileSelected,
  removePendingFile, filePreviewUrl, formatFileSize,
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
</style>

