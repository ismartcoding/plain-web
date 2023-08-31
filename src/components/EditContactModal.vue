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
        <md-outlined-text-field :label="$t('first_name')" v-model="editItem.firstName" />
        <md-outlined-text-field v-if="complexName" :label="$t('middle_name')" v-model="editItem.middleName" />
        <md-outlined-text-field :label="$t('last_name')" v-model="editItem.lastName" />
        <div class="v-center" v-if="!complexName">
          <button class="icon-button" @click="complexName = true">
            <md-ripple />
            <i-material-symbols:keyboard-double-arrow-down-rounded />
          </button>
        </div>
      </div>
      <div class="form-row" v-if="complexName">
        <md-outlined-text-field :label="$t('prefix')" v-model="editItem.prefix" />
        <md-outlined-text-field :label="$t('suffix')" v-model="editItem.suffix" />
        <div class="v-center">
          <button class="icon-button" @click="complexName = false">
            <md-ripple />
            <i-material-symbols:keyboard-double-arrow-up-rounded />
          </button>
        </div>
      </div>
      <label class="form-label">
        {{ $t('phone_number') }}
      </label>
      <div class="form-row" v-for="(item, index) in editItem.phoneNumbers" :key="index">
        <md-outlined-select class="flex-2" menu-fixed="true" v-model.number="item.type" @change="onTypeChanged(item)">
          <md-select-option
            v-for="type of types.phoneNumberTypes"
            :key="type"
            :value="type"
            :headline="getTypeLabel(item, type, 'phone_number_type')"
          />
        </md-outlined-select>
        <md-outlined-text-field :placeholder="$t('telephone')" v-model="item.value" class="flex-3" />
        <div class="v-center">
          <button
            class="icon-button"
            @click="deleteField(editItem.phoneNumbers, index)"
            v-if="editItem.phoneNumbers.length > 1"
          >
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <label class="form-label" v-if="editItem.emails.length">
        {{ $t('email') }}
      </label>
      <div class="form-row" v-for="(item, index) in editItem.emails" :key="index">
        <md-outlined-select class="flex-2" menu-fixed="true" v-model.number="item.type" @change="onTypeChanged(item)">
          <md-select-option
            v-for="type of types.emailTypes"
            :key="type"
            :value="type"
            :headline="getTypeLabel(item, type, 'email_type')"
          />
        </md-outlined-select>
        <md-outlined-text-field :label="$t('email')" v-model="item.value" class="flex-3" />
        <div class="v-center">
          <button class="icon-button" @click="deleteField(editItem.emails, index)">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <label class="form-label" v-if="editItem.addresses.length">
        {{ $t('address') }}
      </label>
      <div class="form-row" v-for="(item, index) in editItem.addresses" :key="index">
        <md-outlined-select class="flex-2" menu-fixed="true" v-model.number="item.type" @change="onTypeChanged(item)">
          <md-select-option
            v-for="type of types.addressTypes"
            :key="type"
            :value="type"
            :headline="getTypeLabel(item, type, 'address_type')"
          />
        </md-outlined-select>
        <md-outlined-text-field :label="$t('address')" v-model="item.value" class="flex-3" />
        <div class="v-center">
          <button class="icon-button" @click="deleteField(editItem.addresses, index)">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <label class="form-label" v-if="editItem.websites.length">
        {{ $t('website') }}
      </label>
      <div class="form-row" v-for="(item, index) in editItem.websites" :key="index">
        <md-outlined-select class="flex-2" menu-fixed="true" v-model.number="item.type" @change="onTypeChanged(item)">
          <md-select-option
            v-for="type of types.websiteTypes"
            :key="type"
            :value="type"
            :headline="getTypeLabel(item, type, 'website_type')"
          />
        </md-outlined-select>
        <md-outlined-text-field :placeholder="$t('website')" v-model="item.value" class="flex-3" />
        <div class="v-center">
          <button class="icon-button" @click="deleteField(editItem.websites, index)">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
        </div>
      </div>
      <label class="form-label" v-if="editItem.ims.length">
        {{ $t('im') }}
      </label>
      <div class="form-row" v-for="(item, index) in editItem.ims" :key="index">
        <md-outlined-select class="flex-2" menu-fixed="true" v-model.number="item.type" @change="onTypeChanged(item)">
          <md-select-option
            v-for="type of types.imTypes"
            :key="type"
            :value="type"
            :headline="getTypeLabel(item, type, 'im_type')"
          />
        </md-outlined-select>
        <md-outlined-text-field :placeholder="$t('im')" v-model="item.value" class="flex-3" />
        <div class="v-center">
          <button class="icon-button" @click="deleteField(editItem.ims, index)">
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
              <md-menu-item :headline="$t('phone_number')" @click="() => addField(slotProps, editItem.phoneNumbers)" />
              <md-menu-item :headline="$t('email')" @click="() => addField(slotProps, editItem.emails)" />
              <md-menu-item :headline="$t('address')" @click="() => addField(slotProps, editItem.addresses)" />
              <md-menu-item :headline="$t('website')" @click="() => addField(slotProps, editItem.websites)" />
              <md-menu-item :headline="$t('im')" @click="() => addField(slotProps, editItem.ims)" />
            </div>
          </template>
        </popper>
      </div>
      <div class="form-row">
        <md-outlined-text-field type="textarea" :label="$t('notes')" v-model="editItem.notes" rows="3" />
      </div>
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="save" :disabled="createLoading || editLoading" @click="doAction" autofocus>
        {{ $t('save') }}
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
  appApi: true,
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
  appApi: true,
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
