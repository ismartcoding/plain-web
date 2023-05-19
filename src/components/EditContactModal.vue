<template>
  <v-modal size="lg" :title="data ? $t('edit') : $t('create')">
    <template #body>
      <div class="row mb-3">
        <label class="col-md-3 col-form-label">{{ $t('name') }}</label>
        <div class="col-md-3">
          <input type="text" class="form-control" :placeholder="$t('first_name')" v-model="editItem.firstName" />
        </div>
        <div class="col-md-3" v-if="complexName">
          <input type="text" class="form-control" :placeholder="$t('middle_name')" v-model="editItem.middleName" />
        </div>
        <div class="col-md-3">
          <input type="text" class="form-control" :placeholder="$t('last_name')" v-model="editItem.lastName" />
        </div>
        <div class="col-md-3" v-if="!complexName">
          <button type="button" class="btn-icon" @click="complexName = true">
            <i-material-symbols:keyboard-double-arrow-down-rounded class="bi" />
          </button>
        </div>
      </div>
      <div class="row mb-3" v-if="complexName">
        <div class="offset-3 col-md-3">
          <input type="text" class="form-control" :placeholder="$t('prefix')" v-model="editItem.prefix" />
        </div>
        <div class="col-md-3">
          <input type="text" class="form-control" :placeholder="$t('suffix')" v-model="editItem.suffix" />
        </div>
        <div class="col-md-3">
          <button type="button" class="btn-icon" @click="complexName = false">
            <i-material-symbols:keyboard-double-arrow-up-rounded class="bi" />
          </button>
        </div>
      </div>
      <div class="row mb-3" v-for="(item, index) in editItem.phoneNumbers" :key="index">
        <label class="col-md-3 col-form-label" v-if="index === 0">{{ $t('phone_number') }}</label>
        <div class="col-md-3" :class="{ 'offset-md-3': index > 0 }">
          <select class="form-select" v-model.number="item.type" @change="onTypeChanged(item)">
            <option v-for="type of types.phoneNumberTypes" :key="type" :value="type">
              {{ getTypeLabel(item, type, 'phone_number_type') }}
            </option>
          </select>
        </div>
        <div class="col-md-4">
          <input type="text" class="form-control" :placeholder="$t('telephone')" v-model="item.value" />
        </div>
        <div class="col-md-2" v-if="editItem.phoneNumbers.length > 1">
          <button type="button" class="btn-icon" @click="deleteField(editItem.phoneNumbers, index)">
            <i-material-symbols:delete-outline-rounded class="bi" />
          </button>
        </div>
      </div>
      <div class="row mb-3" v-for="(item, index) in editItem.emails" :key="index">
        <label class="col-md-3 col-form-label" v-if="index === 0">{{ $t('email') }}</label>
        <div class="col-md-3" :class="{ 'offset-md-3': index > 0 }">
          <select class="form-select" v-model.number="item.type" @change="onTypeChanged(item)">
            <option v-for="type of types.emailTypes" :key="type" :value="type">
              {{ getTypeLabel(item, type, 'email_type') }}
            </option>
          </select>
        </div>
        <div class="col-md-4">
          <input type="text" class="form-control" :placeholder="$t('email')" v-model="item.value" />
        </div>
        <div class="col-md-2">
          <button type="button" class="btn-icon" @click="deleteField(editItem.emails, index)">
            <i-material-symbols:delete-outline-rounded class="bi" />
          </button>
        </div>
      </div>
      <div class="row mb-3" v-for="(item, index) in editItem.addresses" :key="index">
        <label class="col-md-3 col-form-label" v-if="index === 0">{{ $t('address') }}</label>
        <div class="col-md-3" :class="{ 'offset-md-3': index > 0 }">
          <select class="form-select" v-model.number="item.type" @change="onTypeChanged(item)">
            <option v-for="type of types.addressTypes" :key="type" :value="type">
              {{ getTypeLabel(item, type, 'address_type') }}
            </option>
          </select>
        </div>
        <div class="col-md-4">
          <input type="text" class="form-control" :placeholder="$t('address')" v-model="item.value" />
        </div>
        <div class="col-md-2">
          <button type="button" class="btn-icon" @click="deleteField(editItem.addresses, index)">
            <i-material-symbols:delete-outline-rounded class="bi" />
          </button>
        </div>
      </div>

      <div class="row mb-3" v-for="(item, index) in editItem.websites" :key="index">
        <label class="col-md-3 col-form-label" v-if="index === 0">{{ $t('website') }}</label>
        <div class="col-md-3" :class="{ 'offset-md-3': index > 0 }">
          <select class="form-select" v-model.number="item.type" @change="onTypeChanged(item)">
            <option v-for="type of types.websiteTypes" :key="type" :value="type">
              {{ getTypeLabel(item, type, 'website_type') }}
            </option>
          </select>
        </div>
        <div class="col-md-4">
          <input type="text" class="form-control" :placeholder="$t('website')" v-model="item.value" />
        </div>
        <div class="col-md-2">
          <button type="button" class="btn-icon" @click="deleteField(editItem.websites, index)">
            <i-material-symbols:delete-outline-rounded class="bi" />
          </button>
        </div>
      </div>
      <div class="row mb-3" v-for="(item, index) in editItem.ims" :key="index">
        <label class="col-md-3 col-form-label" v-if="index === 0">{{ $t('im') }}</label>
        <div class="col-md-3" :class="{ 'offset-md-3': index > 0 }">
          <select class="form-select" v-model.number="item.type" @change="onTypeChanged(item)">
            <option v-for="type of types.imTypes" :key="type" :value="type">
              {{ getTypeLabel(item, type, 'im_type') }}
            </option>
          </select>
        </div>
        <div class="col-md-4">
          <input type="text" class="form-control" :placeholder="$t('im')" v-model="item.value" />
        </div>
        <div class="col-md-2">
          <button type="button" class="btn-icon" @click="deleteField(editItem.ims, index)">
            <i-material-symbols:delete-outline-rounded class="bi" />
          </button>
        </div>
      </div>
      <div class="row mb-3">
        <label class="col-md-3 col-form-label">{{ $t('notes') }}</label>
        <div class="col-md-8">
          <textarea class="form-control" v-model="editItem.notes" rows="3"></textarea>
        </div>
      </div>
      <div class="row mb-3">
        <div class="offset-3 col-md-3">
          <popper>
            <button type="button" class="btn">{{ $t('add_field') }}</button>
            <template #content="slotProps">
              <ul class="menu-items">
                <li class="dropdown-item" @click="() => addField(slotProps, editItem.phoneNumbers)">
                  {{ $t('phone_number') }}
                </li>
                <li class="dropdown-item" @click="() => addField(slotProps, editItem.emails)">
                  {{ $t('email') }}
                </li>
                <li class="dropdown-item" @click="() => addField(slotProps, editItem.addresses)">
                  {{ $t('address') }}
                </li>
                <li class="dropdown-item" @click="() => addField(slotProps, editItem.websites)">
                  {{ $t('website') }}
                </li>
                <li class="dropdown-item" @click="() => addField(slotProps, editItem.ims)">
                  {{ $t('im') }}
                </li>
              </ul>
            </template>
          </popper>
        </div>
      </div>
    </template>
    <template #action>
      <button type="button" :disabled="createLoading || editLoading" class="btn" @click="doAction">
        {{ $t('save') }}
      </button>
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
