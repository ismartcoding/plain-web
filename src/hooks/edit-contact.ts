import { reactive, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { useField, useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { initMutation, createContactGQL, updateContactGQL } from '@/lib/api/mutation'
import { types } from '@/lib/contact/contact'
import { popModal, pushModal } from '@/components/modal'
import PromptModal from '@/components/PromptModal.vue'
import type { IContact, IContactContentItem, IContactPhoneNumber } from '@/lib/interfaces'

export function useEditContact(data: IContact | undefined, sources: any[], done: () => void) {
  const { t } = useI18n()
  const { handleSubmit } = useForm()

  const editItem = reactive({
    firstName: '', middleName: '', lastName: '', prefix: '', suffix: '',
    nickname: '', organization: null as any, notes: '', source: '', starred: 0,
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

  const { mutate: create, loading: createLoading, onDone: createDone } = initMutation({
    document: createContactGQL,
  })
  createDone(() => { done(); popModal() })

  const { mutate: edit, loading: editLoading, onDone: editDone } = initMutation({
    document: updateContactGQL,
  })
  editDone(() => { done(); popModal() })

  const { resetField } = useField('inputValue', toTypedSchema(z.any()))

  // Initialize form data
  const copyContentItems = (items: any[], newItems: any[]) => {
    items.splice(0, items.length)
    for (const item of newItems) items.push({ label: item.label, value: item.value, type: item.type })
  }

  if (data) {
    Object.assign(editItem, { firstName: data.firstName, middleName: data.middleName, lastName: data.lastName, prefix: data.prefix, suffix: data.suffix, notes: data.notes })
    copyContentItems(editItem.phoneNumbers, data.phoneNumbers)
    copyContentItems(editItem.emails, data.emails)
    copyContentItems(editItem.addresses, data.addresses)
    copyContentItems(editItem.websites, data.websites)
    copyContentItems(editItem.events, data.events)
    copyContentItems(editItem.ims, data.ims)
  } else {
    Object.assign(editItem, { firstName: '', middleName: '', lastName: '', prefix: '', suffix: '', notes: '', phoneNumbers: [{ type: 2, value: '', label: '' }], emails: [], addresses: [], websites: [], events: [], ims: [] })
    resetField()
  }

  const onTypeChanged = (item: any) => {
    if (item.type === -1) {
      pushModal(PromptModal, { value: item.label, title: t('custom'), do: (value: string) => { item.label = value } })
    }
  }

  const getTypeLabel = (item: any, type: number, key: string) => {
    return type === -1 ? (item.label || t('custom')) : t(`contact.${key}.${type}`)
  }

  const createTypeOptions = (typeArray: number[], key: string, item: any) => {
    return typeArray.map((type) => ({ value: type, label: getTypeLabel(item, type, key) }))
  }

  const addField = (items: any[]) => { items.push({ type: 1, value: '', label: '' }); addFieldMenuVisible.value = false }
  const deleteField = (items: any[], index: number) => { items.splice(index, 1) }

  const doAction = handleSubmit(() => {
    if (data) { edit({ id: data.id, input: editItem }) }
    else { editItem.source = sources?.[0]?.name ?? ''; create({ input: editItem }) }
  })

  return {
    editItem, complexName, addFieldMenuVisible, createLoading, editLoading, types,
    onTypeChanged, createTypeOptions, addField, deleteField, doAction,
  }
}
