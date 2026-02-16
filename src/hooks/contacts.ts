import { ref } from 'vue'
import { initLazyQuery } from '@/lib/api/query'
import gql from 'graphql-tag'
import { contactFragment } from '@/lib/api/fragments'
import type { IContact } from '@/lib/interfaces'
import { containsChinese } from '@/lib/strutil'

const contactsMap = ref<Map<string, string>>(new Map())
let loaded = false

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, '').slice(-10)
}

function fullName(item: IContact): string {
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

const allContactsGQL = gql`
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
