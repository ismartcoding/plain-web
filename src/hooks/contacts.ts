import { ref } from 'vue'
import { initLazyQuery } from '@/lib/api/query'
import { contactFragment } from '@/lib/api/fragments'
import type { IContact } from '@/lib/interfaces'
import { getContactFullName } from '@/lib/contact/format'

const contactsMap = ref<Map<string, string>>(new Map())
let loaded = false

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, '').slice(-10)
}

const fullName = getContactFullName

const allContactsGQL = `
  query allContacts {
    contacts(offset: 0, limit: 10000, query: "") {
      ...ContactFragment
    }
  }
  ${contactFragment}
`

export function useContactName() {
  const { fetch } = initLazyQuery({
    handle: (data: { contacts: IContact[] }, error: string) => {
      if (error) return
      if (data) {
        const map = new Map<string, string>()
        for (const contact of data.contacts) {
          const name = fullName(contact)
          if (!name) continue
          for (const phone of contact.phoneNumbers) {
            const normalized = normalizePhone(phone.value)
            if (normalized) map.set(normalized, name)
            if (phone.normalizedNumber) {
              const nn = normalizePhone(phone.normalizedNumber)
              if (nn) map.set(nn, name)
            }
          }
        }
        contactsMap.value = map
        loaded = true
      }
    },
    document: allContactsGQL,
    variables: () => ({}),
  })

  function loadContacts() {
    if (!loaded) {
      fetch()
    }
  }

  function getContactName(address: string): string {
    if (!address) return ''
    const normalized = normalizePhone(address)
    return contactsMap.value.get(normalized) || ''
  }

  function getDisplayName(address: string): string {
    const name = getContactName(address)
    return name || address || '-'
  }

  return { loadContacts, getContactName, getDisplayName, contactsMap }
}
