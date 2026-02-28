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
import { nextTick, onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useForm } from 'vee-validate'
import { object, string } from 'yup'
import { popModal } from '@/components/modal'
import { initMutation, sendSmsGQL, sendMmsGQL } from '@/lib/api/mutation'
import { initLazyQuery, contactsGQL } from '@/lib/api/query'
import tapPhone from '@/plugins/tapphone'
import { upload as uploadFile } from '@/lib/upload/upload'
import { shortUUID, containsChinese } from '@/lib/strutil'
import type { IUploadItem } from '@/stores/temp'
import type { IContact } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { app } = storeToRefs(useTempStore())

const props = defineProps({
  number: { type: String, default: '' },
  body: { type: String, default: '' },
})

const pendingFiles = ref<File[]>([])
const fileInputRef = ref<HTMLInputElement>()
const mmsUploading = ref(false)

// Contact picker
const showContactPicker = ref(false)
const allContacts = ref<IContact[]>([])
const selectedContactName = ref('')
const phoneFieldRef = ref<HTMLElement>()

function getContactFullName(item: IContact): string {
  let name = ''
  if (containsChinese(item.firstName) || containsChinese(item.lastName)) {
    name = `${item.lastName}${item.middleName}${item.firstName}`
  } else {
    name = [item.firstName, item.middleName, item.lastName].filter((it) => it).join(' ')
  }
  const suffixComma = item.suffix ? `, ${item.suffix}` : ''
  const fn = `${item.prefix} ${name} ${suffixComma}`.trim()
  if (fn) return fn
  if (item.emails.length) return item.emails[0].value
  return ''
}

const filteredContacts = computed(() => {
  const contacts = allContacts.value.filter((c) => c.phoneNumbers.length > 0)
  const q = (number.value || '').trim().toLowerCase()
  if (!q) return contacts
  return contacts.filter(
    (c) =>
      getContactFullName(c).toLowerCase().includes(q) ||
      c.phoneNumbers.some(
        (p) => (p.normalizedNumber || p.value).toLowerCase().includes(q)
      )
  )
})

const { loading: contactsLoading, fetch: fetchContacts } = initLazyQuery({
  handle: (data: { contacts: IContact[] }, error: string) => {
    if (!error && data) {
      allContacts.value = data.contacts
    }
  },
  document: contactsGQL,
  variables: () => ({ offset: 0, limit: 5000, query: '' }),
})

function toggleContactPicker() {
  showContactPicker.value = !showContactPicker.value
  if (showContactPicker.value && allContacts.value.length === 0) {
    fetchContacts()
  }
}

function onNumberInput() {
  // Clear selected contact name when user manually edits
  selectedContactName.value = ''
  // Show dropdown as user types if contacts are loaded
  if (allContacts.value.length > 0 && number.value?.trim()) {
    showContactPicker.value = true
  }
}

function onNumberFocus() {
  if (allContacts.value.length > 0 && number.value?.trim()) {
    showContactPicker.value = true
  }
}

function selectContactNumber(phone: string, contact: IContact) {
  number.value = phone
  selectedContactName.value = getContactFullName(contact)
  showContactPicker.value = false
}

function clearSelectedContact() {
  selectedContactName.value = ''
  number.value = ''
}

function handleClickOutside(e: MouseEvent) {
  if (phoneFieldRef.value && !phoneFieldRef.value.contains(e.target as Node)) {
    showContactPicker.value = false
  }
}

const MMS_WARN_SIZE = 300 * 1024
const totalPendingSize = computed(() => pendingFiles.value.reduce((s, f) => s + f.size, 0))
const hasLargeNonImageFile = computed(() =>
  pendingFiles.value.some((f) => !f.type.startsWith('image/') && f.size > MMS_WARN_SIZE)
)

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

const { errors, defineField, handleSubmit } = useForm({
  validationSchema: object({
    number: string().trim().required(),
    body: string().trim().required(),
  }),
  initialValues: {
    number: props.number,
    body: props.body,
  },
})

const [number] = defineField('number')
const [body] = defineField('body')

const { mutate, loading, onDone } = initMutation({
  document: sendSmsGQL,
})

const { mutate: mutateMms, loading: mmsLoading, onDone: onMmsDone } = initMutation({
  document: sendMmsGQL,
})

const numberRef = ref<HTMLInputElement>()

const cancel = () => {
  popModal()
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    pendingFiles.value = [...pendingFiles.value, ...Array.from(input.files)]
  }
  input.value = ''
}

function removePendingFile(index: number) {
  pendingFiles.value = pendingFiles.value.filter((_, i) => i !== index)
}

function filePreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}

async function uploadAttachments(): Promise<string[]> {
  const paths: string[] = []
  const mmsDir = `${app.value.appDir}/mms_tmp`
  for (const file of pendingFiles.value) {
    const item: IUploadItem = {
      id: shortUUID(),
      dir: mmsDir,
      fileName: file.name,
      file,
      status: 'pending',
      uploadedSize: 0,
      error: '',
      isAppFile: false,
    }
    const result = await uploadFile(item, false) as { fileName?: string; error?: string } | undefined
    if (result && result.fileName) {
      paths.push(`${mmsDir}/${result.fileName}`)
    } else {
      throw new Error(t('upload_failed'))
    }
  }
  return paths
}

const submit = handleSubmit(async () => {
  if (pendingFiles.value.length > 0) {
    // Send MMS
    mmsUploading.value = true
    try {
      const attachmentPaths = await uploadAttachments()
      mutateMms({ number: number.value, body: body.value || '', attachmentPaths, threadId: '' })
    } catch (e: any) {
      toast(e.message || t('upload_failed'), 'error')
    } finally {
      mmsUploading.value = false
    }
  } else {
    // Send SMS
    mutate({ number: number.value, body: body.value })
  }
}, () => {
  // Validation failed, but if we have attachments we can still send MMS without body
  if (pendingFiles.value.length > 0 && number.value?.trim()) {
    const doSend = async () => {
      mmsUploading.value = true
      try {
        const attachmentPaths = await uploadAttachments()
        mutateMms({ number: number.value, body: body.value || '', attachmentPaths, threadId: '' })
      } catch (e: any) {
        toast(e.message || t('upload_failed'), 'error')
      } finally {
        mmsUploading.value = false
      }
    }
    doSend()
  }
})

onDone(() => {
  emitter.emit('sms_sent')
  popModal()
})

onMmsDone(() => {
  tapPhone(t('confirm_mms_on_phone'))
  popModal()
})

onMounted(async () => {
  document.addEventListener('click', handleClickOutside, true)
  await nextTick()
  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur()
        }
        numberRef.value?.focus()
      } catch (error) {
        console.debug('Focus blocked:', error)
      }
    }, 100)
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true)
})
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
