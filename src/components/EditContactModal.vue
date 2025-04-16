<template>
  <md-dialog>
    <div slot="headline">
      {{ data ? $t('edit') : $t('create') }}
    </div>
    <div slot="content">
      <label class="form-label">
        {{ $t('name') }}
      </label>
      <div class="form-row">
        <md-outlined-text-field v-model="editItem.firstName" :label="$t('first_name')" />
        <md-outlined-text-field v-if="complexName" v-model="editItem.middleName" :label="$t('middle_name')" />
        <md-outlined-text-field v-model="editItem.lastName" :label="$t('last_name')" />
        <div v-if="!complexName" class="v-center">
          <button class="btn-icon" @click="complexName = true">
            <md-ripple />
            <i-material-symbols:keyboard-double-arrow-down-rounded />
          </button>
        </div>
      </div>
      <div v-if="complexName" class="form-row">
        <md-outlined-text-field v-model="editItem.prefix" :label="$t('prefix')" />
        <md-outlined-text-field v-model="editItem.suffix" :label="$t('suffix')" />
        <div class="v-center">
          <button class="btn-icon" @click="complexName = false">
            <md-ripple />
            <i-material-symbols:keyboard-double-arrow-up-rounded />
          </button>
        </div>
      </div>
      <label class="form-label">
        {{ $t('phone_number') }}
      </label>
      <div v-for="(item, index) in editItem.phoneNumbers" :key="index" class="form-row">
        <md-outlined-select v-model.number="item.type" class="flex-2" menu-positioning="fixed" @change="onTypeChanged(item)">
          <md-select-option v-for="type of types.phoneNumberTypes" :key="type" :value="type">
            <div slot="headline">{{ getTypeLabel(item, type, 'phone_number_type') }}</div>
          </md-select-option>
        </md-outlined-select>
        <md-outlined-text-field v-model="item.value" :placeholder="$t('telephone')" class="flex-3" />
        <div class="v-center">
          <button v-if="editItem.phoneNumbers.length > 1" class="btn-icon" @click="deleteField(editItem.phoneNumbers, index)">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <label v-if="editItem.emails.length" class="form-label">
        {{ $t('email') }}
      </label>
      <div v-for="(item, index) in editItem.emails" :key="index" class="form-row">
        <md-outlined-select v-model.number="item.type" class="flex-2" menu-positioning="fixed" @change="onTypeChanged(item)">
          <md-select-option v-for="type of types.emailTypes" :key="type" :value="type">
            <div slot="headline">{{ getTypeLabel(item, type, 'email_type') }}</div>
          </md-select-option>
        </md-outlined-select>
        <md-outlined-text-field v-model="item.value" :label="$t('email')" class="flex-3" />
        <div class="v-center">
          <button class="btn-icon" @click="deleteField(editItem.emails, index)">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <label v-if="editItem.addresses.length" class="form-label">
        {{ $t('address') }}
      </label>
      <div v-for="(item, index) in editItem.addresses" :key="index" class="form-row">
        <md-outlined-select v-model.number="item.type" class="flex-2" menu-positioning="fixed" @change="onTypeChanged(item)">
          <md-select-option v-for="type of types.addressTypes" :key="type" :value="type">
            <div slot="headline">{{ getTypeLabel(item, type, 'address_type') }}</div>
          </md-select-option>
        </md-outlined-select>
        <md-outlined-text-field v-model="item.value" :label="$t('address')" class="flex-3" />
        <div class="v-center">
          <button class="btn-icon" @click="deleteField(editItem.addresses, index)">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <label v-if="editItem.websites.length" class="form-label">
        {{ $t('website') }}
      </label>
      <div v-for="(item, index) in editItem.websites" :key="index" class="form-row">
        <md-outlined-select v-model.number="item.type" class="flex-2" menu-positioning="fixed" @change="onTypeChanged(item)">
          <md-select-option v-for="type of types.websiteTypes" :key="type" :value="type">
            <div slot="headline">{{ getTypeLabel(item, type, 'website_type') }}</div>
          </md-select-option>
        </md-outlined-select>
        <md-outlined-text-field v-model="item.value" :placeholder="$t('website')" class="flex-3" />
        <div class="v-center">
          <button class="btn-icon" @click="deleteField(editItem.websites, index)">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <label v-if="editItem.ims.length" class="form-label">
        {{ $t('im') }}
      </label>
      <div v-for="(item, index) in editItem.ims" :key="index" class="form-row">
        <md-outlined-select v-model.number="item.type" class="flex-2" menu-positioning="fixed" @change="onTypeChanged(item)">
          <md-select-option v-for="type of types.imTypes" :key="type" :value="type">
            <div slot="headline">{{ getTypeLabel(item, type, 'im_type') }}</div>
          </md-select-option>
        </md-outlined-select>
        <md-outlined-text-field v-model="item.value" :placeholder="$t('im')" class="flex-3" />
        <div class="v-center">
          <button class="btn-icon" @click="deleteField(editItem.ims, index)">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <div class="form-row" style="display: block; position: relative">
        <popper placement="auto">
          <div>
            <md-outlined-button>{{ $t('add_field') }}</md-outlined-button>
          </div>
          <template #content="slotProps">
            <div class="menu-items">
              <md-menu-item @click="() => addField(slotProps, editItem.phoneNumbers)">
                <div slot="headline">{{ $t('phone_number') }}</div>
              </md-menu-item>
              <md-menu-item @click="() => addField(slotProps, editItem.emails)">
                <div slot="headline">{{ $t('email') }}</div>
              </md-menu-item>
              <md-menu-item @click="() => addField(slotProps, editItem.addresses)">
                <div slot="headline">{{ $t('address') }}</div>
              </md-menu-item>
              <md-menu-item @click="() => addField(slotProps, editItem.websites)">
                <div slot="headline">{{ $t('website') }}</div>
              </md-menu-item>
              <md-menu-item @click="() => addField(slotProps, editItem.ims)">
                <div slot="headline">{{ $t('im') }}</div>
              </md-menu-item>
            </div>
          </template>
        </popper>
      </div>
      <div class="form-row">
        <md-outlined-text-field v-model="editItem.notes" type="textarea" :label="$t('notes')" rows="3" />
      </div>
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="save" :disabled="createLoading || editLoading" autofocus @click="doAction">
        <md-circular-progress v-if="createLoading || editLoading" slot="icon" indeterminate /> {{ $t('save') }}
      </md-filled-button>
    </div>
  </md-dialog>
</template>
<script setup lang="ts">
import { initMutation } from '@/lib/api/mutation'
import { useField, useForm } from 'vee-validate'
import { reactive, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { gql } from '@apollo/client/core'
import { string } from 'yup'
import { contactFragment } from '@/lib/api/fragments'
import { types } from '@/lib/contact/contact'
import { popModal, pushModal } from './modal'
import PromptModal from '@/components/PromptModal.vue'

const { handleSubmit } = useForm()

const props = defineProps({
  data: { type: Object },
  sources: { type: Array as PropType<any[]> },
  done: {
    type: Function as PropType<() => void>,
    required: true,
  },
})

const editItem = reactive({
  firstName: '',
  middleName: '',
  lastName: '',
  prefix: '',
  suffix: '',
  nickname: '',
  organization: null,
  notes: '',
  source: '',
  starred: 0,
  phoneNumbers: [],
  emails: [],
  addresses: [],
  websites: [],
  events: [],
  ims: [],
  groupIds: [],
})

const complexName = ref(false)

const { t } = useI18n()

const {
  mutate: create,
  loading: createLoading,
  onDone: createDone,
} = initMutation({
  document: gql`
    mutation createContact($input: ContactInput!) {
      createContact(input: $input) {
        ...ContactFragment
      }
    }
    ${contactFragment}
  `,
  options: {
    update: () => {
      props.done()
    },
  },
})
const {
  mutate: edit,
  loading: editLoading,
  onDone: editDone,
} = initMutation({
  document: gql`
    mutation updateContact($id: ID!, $input: ContactInput!) {
      updateContact(id: $id, input: $input) {
        ...ContactFragment
      }
    }
    ${contactFragment}
  `,
  options: {
    update: () => {
      props.done()
    },
  },
})

const {
  value: targetValue,
  resetField,
  errorMessage: valueError,
} = useField(
  'inputValue',
  string()
    .test(
      'required',
      (d) => 'valid.required',
      (value) => true
    )
    .test(
      'target-value',
      (d) => 'invalid_value',
      (value) => true
    )
)

const copyContentItems = (items: any[], newItems: any[]) => {
  items.splice(0, items.length)
  for (const item of newItems) {
    items.push({ label: item.label, value: item.value, type: item.type })
  }
}

;(() => {
  const data = props.data
  if (data) {
    Object.assign(editItem, {
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      prefix: data.prefix,
      suffix: data.suffix,
      notes: data.notes,
    })
    copyContentItems(editItem.phoneNumbers, data.phoneNumbers)
    copyContentItems(editItem.emails, data.emails)
    copyContentItems(editItem.addresses, data.addresses)
    copyContentItems(editItem.websites, data.websites)
    copyContentItems(editItem.events, data.events)
    copyContentItems(editItem.ims, data.ims)
  } else {
    Object.assign(editItem, {
      firstName: '',
      middleName: '',
      lastName: '',
      prefix: '',
      suffix: '',
      notes: '',
      phoneNumbers: [{ type: 2, value: '', label: '' }],
      emails: [],
      addresses: [],
      websites: [],
      events: [],
      ims: [],
    })
    resetField()
  }
})()

const onTypeChanged = (item: any) => {
  if (item.type === -1) {
    pushModal(PromptModal, {
      value: item.label,
      title: t('custom'),
      do: (value: string) => {
        item.label = value
      },
    })
  }
}

const getTypeLabel = (item: any, type: number, key: string) => {
  if (type === -1) {
    return item.label ? item.label : t('custom')
  }
  return t(`contact.${key}.${type}`)
}

const addField = (slotProps: any, items: any[]) => {
  items.push({ type: 1, value: '', label: '' })
  slotProps.close()
}

const deleteField = (items: any[], index: number) => {
  items.splice(index, 1)
}

const doAction = handleSubmit(() => {
  if (props.data) {
    edit({ id: props.data.id, input: editItem })
  } else {
    editItem.source = props.sources?.[0]?.name ?? ''
    create({ input: editItem })
  }
})

createDone(() => {
  popModal()
})

editDone(() => {
  popModal()
})
</script>
<style lang="scss" scoped></style>
