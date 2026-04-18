import { ref, computed } from 'vue'
import { initLazyQuery, contactsGQL } from '@/lib/api/query'
import { getContactFullName } from '@/lib/contact/format'
import type { IContact } from '@/lib/interfaces'

export function useContactPicker(getQuery: () => string) {
  const showContactPicker = ref(false)
  const allContacts = ref<IContact[]>([])
  const selectedContactName = ref('')

  const filteredContacts = computed(() => {
    const contacts = allContacts.value.filter((c) => c.phoneNumbers.length > 0)
    const q = (getQuery() || '').trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(
      (c) =>
        getContactFullName(c).toLowerCase().includes(q) ||
        c.phoneNumbers.some((p) => (p.normalizedNumber || p.value).toLowerCase().includes(q)),
    )
  })

  const { loading: contactsLoading, fetch: fetchContacts } = initLazyQuery({
    handle: (data: { contacts: IContact[] }, error: string) => {
      if (!error && data) allContacts.value = data.contacts
    },
    document: contactsGQL,
    variables: () => ({ offset: 0, limit: 5000, query: '' }),
  })

  function toggleContactPicker() {
    showContactPicker.value = !showContactPicker.value
    if (showContactPicker.value && allContacts.value.length === 0) fetchContacts()
  }

  function onNumberInput(value: string) {
    selectedContactName.value = ''
    if (value?.trim()) {
      if (allContacts.value.length === 0) fetchContacts()
      showContactPicker.value = true
    } else {
      showContactPicker.value = false
    }
  }

  function onNumberFocus(value: string) {
    if (value?.trim() && allContacts.value.length > 0) {
      showContactPicker.value = true
    }
  }

  function selectContactNumber(phone: string, contact: IContact, setNumber: (n: string) => void) {
    setNumber(phone)
    selectedContactName.value = getContactFullName(contact)
    showContactPicker.value = false
  }

  function clearSelectedContact(clearNumber: () => void) {
    selectedContactName.value = ''
    clearNumber()
  }

  return {
    showContactPicker,
    selectedContactName,
    filteredContacts,
    contactsLoading,
    toggleContactPicker,
    onNumberInput,
    onNumberFocus,
    selectContactNumber,
    clearSelectedContact,
    getContactFullName,
  }
}
