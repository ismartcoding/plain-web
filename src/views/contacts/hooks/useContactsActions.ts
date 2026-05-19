import { ref, type Ref } from 'vue'
import type { IContact, IContactSource, ITag, ISim } from '@/lib/interfaces'
import { getContactFullName } from '@/lib/contact/format'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import EditContactModal from '@/components/EditContactModal.vue'
import SendSmsModal from '@/views/messages/SendSmsModal.vue'
import { callGQL, deleteContactsGQL, initMutation } from '@/lib/api/mutation'
import { simsGQL, initQuery } from '@/lib/api/query'
import emitter from '@/plugins/eventbus'
import { DataType } from '@/lib/data'

interface UseContactsActionsOptions {
  items: Ref<IContact[]>
  tags: Ref<ITag[]>
  total: Ref<number>
  sources: Ref<IContactSource[]>
  fetch: () => void
}

export function useContactsActions(opts: UseContactsActionsOptions) {
  const { items, tags, total, sources, fetch } = opts
  const dataType = DataType.CONTACT

  const callId = ref('')
  const callIndex = ref(0)
  const sims = ref<ISim[]>([])
  const { mutate: mutateCall, loading: callLoading } = initMutation({ document: callGQL })

  initQuery({
    document: simsGQL,
    handle(data: any, error: string) {
      if (!error) sims.value = data?.sims ?? []
    },
  })

  const fullName = getContactFullName

  function deleteItem(item: IContact) {
    openModal(DeleteConfirm, {
      id: item.id,
      name: fullName(item),
      gql: deleteContactsGQL,
      variables: () => ({ query: `ids:${item.id}` }),
      typeName: 'Contact',
      done: () => {
        items.value = items.value.filter((it) => it.id !== item.id)
        total.value--
        if (item.tags.length) emitter.emit('refetch_tags', dataType)
      },
    })
  }

  function edit(item: IContact) {
    openModal(EditContactModal, { data: item, sources, done: fetch })
  }

  function create() {
    openModal(EditContactModal, { data: null, sources, done: fetch })
  }

  function call(id: string, number: string, index: number) {
    callId.value = id
    callIndex.value = index
    mutateCall({ number, showDialer: sims.value.length > 1 })
  }

  function sendSms(id: string, number: string, index: number) {
    callId.value = id
    callIndex.value = index
    openModal(SendSmsModal, { number })
  }

  return { callId, callIndex, callLoading, call, sendSms, deleteItem, edit, create }
}
