<template>
  <div class="card phone-card">
    <div class="card-content">
      <h5 class="card-title">{{ $t('call_phone') }}</h5>
      <div class="phone-input-row">
        <div class="phone-field-wrapper">
          <ContactPickerDropdown
            v-model="showContactPicker"
            :contacts="filteredContacts"
            :loading="contactsLoading"
            @select="selectContactNumber"
          >
            <template #default="{ toggle }">
              <v-text-field
                v-model="callNumber"
                type="tel"
                :label="$t('phone_number')"
                :error="callNumberError"
                :error-text="$t('valid.required')"
                @input="onNumberInput"
                @focus="onNumberFocus"
                @keyup.enter="callPhone"
              >
                <template #trailing-icon>
                  <v-icon-button @click.prevent="pastePhoneNumber">
                    <i-material-symbols:content-paste-rounded />
                  </v-icon-button>
                </template>
              </v-text-field>
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
        <v-filled-button class="call-btn" :disabled="callLoading" @click.prevent="callPhone">
          {{ $t('call') }}
        </v-filled-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePhoneAction } from './home'
import ContactPickerDropdown from '@/components/ContactPickerDropdown.vue'

const {
  callNumber, callNumberError, callLoading, pastePhoneNumber, callPhone,
  showContactPicker, selectedContactName, filteredContacts, contactsLoading,
  onNumberInput, onNumberFocus, selectContactNumber, clearSelectedContact,
} = usePhoneAction()
</script>

<style scoped lang="scss">
.phone-card {
  grid-column: span 2;
  min-height: 144px;

  .card-content {
    text-align: left;

    .card-title {
      font-size: 1rem;
      font-weight: 500;
      margin: 0 0 16px 0;
      text-transform: none;
      color: var(--md-sys-color-on-surface);
    }

    .phone-input-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;

      .phone-field-wrapper {
        flex: 1;
        min-width: 0;
      }

      .call-btn {
        margin-top: 8px;
        min-width: 80px;
      }
    }
  }
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

