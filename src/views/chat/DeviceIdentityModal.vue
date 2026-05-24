<template>
  <v-modal @close="popModal">
    <template #headline>
      {{ $t('device_identity') }}
    </template>
    <template #content>
      <div v-if="loading" class="identity-loading">
        <v-circular-progress indeterminate class="sm" />
      </div>
      <div v-else-if="identity" class="identity-form">
        <div class="form-row">
          <label class="form-label">{{ $t('device_name') }}</label>
          <input
            v-model="editName"
            class="form-input"
            type="text"
            :placeholder="$t('device_name')"
            maxlength="64"
          />
        </div>
        <div class="form-row">
          <label class="form-label">{{ $t('client_id') }}</label>
          <input class="form-input" type="text" :value="identity.clientId" readonly />
        </div>
        <div class="form-row">
          <label class="form-label">{{ $t('public_key') }}</label>
          <input class="form-input mono" type="text" :value="identity.publicKey" readonly />
        </div>
      </div>
    </template>
    <template #actions>
      <v-outlined-button @click="popModal">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button :disabled="!canSave || saving" @click="save">{{ $t('save') }}</v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { popModal } from '@/components/modal'
import { useDeviceIdentity } from '@/hooks/use-device-identity'

const { identity, loading, saving, load, saveName } = useDeviceIdentity()
const editName = ref('')

const canSave = computed(
  () => editName.value.trim().length > 0 && editName.value !== identity.value?.deviceName
)

async function save() {
  await saveName(editName.value.trim())
}

onMounted(async () => {
  await load()
  editName.value = identity.value?.deviceName ?? ''
})
</script>

<style lang="scss" scoped>
.identity-loading {
  display: flex;
  justify-content: center;
  padding: 24px;
}

.identity-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.form-input {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--color-primary);
  }

  &[readonly] {
    color: var(--color-text-secondary);
    cursor: default;
  }

  &.mono {
    font-family: monospace;
    font-size: 0.75rem;
    word-break: break-all;
  }
}
</style>
