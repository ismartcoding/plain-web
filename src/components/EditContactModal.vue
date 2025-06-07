<template>
  <v-modal @close="popModal">
    <template #headline>
      {{ data ? $t('edit') : $t('create') }}
    </template>
    <template #content>
      <label class="form-label">
        {{ $t('name') }}
      </label>
      <div class="form-row">
        <v-text-field v-model="editItem.firstName" :label="$t('first_name')" />
        <v-text-field v-if="complexName" v-model="editItem.middleName" :label="$t('middle_name')" />
        <v-text-field v-model="editItem.lastName" :label="$t('last_name')" />
        <div v-if="!complexName" class="v-center">
          <button class="btn-icon" @click="complexName = true">
            
            <i-material-symbols:keyboard-double-arrow-down-rounded />
          </button>
        </div>
      </div>
      <div v-if="complexName" class="form-row">
        <v-text-field v-model="editItem.prefix" :label="$t('prefix')" />
        <v-text-field v-model="editItem.suffix" :label="$t('suffix')" />
        <div class="v-center">
          <button class="btn-icon" @click="complexName = false">
            
            <i-material-symbols:keyboard-double-arrow-up-rounded />
          </button>
        </div>
      </div>
      <label class="form-label">
        {{ $t('phone_number') }}
      </label>
      <div v-for="(item, index) in editItem.phoneNumbers" :key="index" class="form-row">
        <v-select 
          v-model.number="item.type" 
          class="flex-2" 
          :options="createTypeOptions(types.phoneNumberTypes, 'phone_number_type', item)"
          @change="onTypeChanged(item)"
        />
        <v-text-field v-model="item.value" :placeholder="$t('telephone')" class="flex-3" />
        <div class="v-center">
          <button v-if="editItem.phoneNumbers.length > 1" class="btn-icon" @click="deleteField(editItem.phoneNumbers, index)">
            
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <label v-if="editItem.emails.length" class="form-label">
        {{ $t('email') }}
      </label>
      <div v-for="(item, index) in editItem.emails" :key="index" class="form-row">
        <v-select 
          v-model.number="item.type" 
          class="flex-2" 
          :options="createTypeOptions(types.emailTypes, 'email_type', item)"
          @change="onTypeChanged(item)"
        />
        <v-text-field v-model="item.value" :label="$t('email')" class="flex-3" />
        <div class="v-center">
          <button class="btn-icon" @click="deleteField(editItem.emails, index)">
            
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <label v-if="editItem.addresses.length" class="form-label">
        {{ $t('address') }}
      </label>
      <div v-for="(item, index) in editItem.addresses" :key="index" class="form-row">
        <v-select 
          v-model.number="item.type" 
          class="flex-2" 
          :options="createTypeOptions(types.addressTypes, 'address_type', item)"
          @change="onTypeChanged(item)"
        />
        <v-text-field v-model="item.value" :label="$t('address')" class="flex-3" />
        <div class="v-center">
          <button class="btn-icon" @click="deleteField(editItem.addresses, index)">
            
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <label v-if="editItem.websites.length" class="form-label">
        {{ $t('website') }}
      </label>
      <div v-for="(item, index) in editItem.websites" :key="index" class="form-row">
        <v-select 
          v-model.number="item.type" 
          class="flex-2" 
          :options="createTypeOptions(types.websiteTypes, 'website_type', item)"
          @change="onTypeChanged(item)"
        />
        <v-text-field v-model="item.value" :placeholder="$t('website')" class="flex-3" />
        <div class="v-center">
          <button class="btn-icon" @click="deleteField(editItem.websites, index)">
            
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <label v-if="editItem.ims.length" class="form-label">
        {{ $t('im') }}
      </label>
      <div v-for="(item, index) in editItem.ims" :key="index" class="form-row">
        <v-select 
          v-model.number="item.type" 
          class="flex-2" 
          :options="createTypeOptions(types.imTypes, 'im_type', item)"
          @change="onTypeChanged(item)"
        />
        <v-text-field v-model="item.value" :placeholder="$t('im')" class="flex-3" />
        <div class="v-center">
          <button class="btn-icon" @click="deleteField(editItem.ims, index)">
            
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <div class="form-row" style="display: block; position: relative">
        <v-dropdown v-model="addFieldMenuVisible" placement="auto" align="top-left-to-bottom-left">
          <template #trigger>
            <v-outlined-button>{{ $t('add_field') }}</v-outlined-button>
          </template>
          <div class="dropdown-item" @click="() => addField(editItem.phoneNumbers)">
            {{ $t('phone_number') }}
          </div>
          <div class="dropdown-item" @click="() => addField(editItem.emails)">
            {{ $t('email') }}
          </div>
          <div class="dropdown-item" @click="() => addField(editItem.addresses)">
            {{ $t('address') }}
          </div>
          <div class="dropdown-item" @click="() => addField(editItem.websites)">
            {{ $t('website') }}
          </div>
          <div class="dropdown-item" @click="() => addField(editItem.ims)">
            {{ $t('im') }}
          </div>
        </v-dropdown>
      </div>
      <div class="form-row">
        <v-text-field v-model="editItem.notes" type="textarea" :label="$t('notes')" :rows="3" />
      </div>
    </template>
    <template #actions>
      <v-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button value="save" :disabled="createLoading || editLoading" @click="doAction">
        <v-circular-progress v-if="createLoading || editLoading" slot="icon" indeterminate />
        {{ $t('save') }}
      </v-filled-button>
    </template>
  </v-modal>
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
import type { IContact, IContactContentItem, IContactPhoneNumber } from '@/lib/interfaces'

const { handleSubmit } = useForm()

const props = defineProps({
  data: { type: Object as PropType<IContact>, default: () => ({}) },
  sources: { type: Array as PropType<any[]>, default: () => [] },
  done: {
    type: Function as PropType<() => void>,
    default: () => {},
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
  phoneNumbers: [] as IContactPhoneNumber[],
  emails: [] as IContactContentItem[],
  addresses: [] as IContactContentItem[],
  websites: [] as IContactContentItem[],
  events: [] as IContactContentItem[],
  ims: [] as IContactContentItem[],
  groupIds: [] as string[],
})

const complexName = ref(false)
const addFieldMenuVisible = ref(false)

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

// 创建选项数组的计算属性
const createTypeOptions = (typeArray: number[], key: string, item: any) => {
  return typeArray.map(type => ({
    value: type,
    label: getTypeLabel(item, type, key)
  }))
}

const addField = (items: any[]) => {
  items.push({ type: 1, value: '', label: '' })
  addFieldMenuVisible.value = false
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
