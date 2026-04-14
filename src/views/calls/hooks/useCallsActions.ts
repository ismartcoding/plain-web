import { ref, type Ref } from 'vue'
import type { ICall, ITag } from '@/lib/interfaces'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { callGQL, deleteCallsGQL, initMutation } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'
import { DataType } from '@/lib/data'

interface UseCallsActionsOptions {
  items: Ref<ICall[]>
  tags: Ref<ITag[]>
  total: Ref<number>
}

export function useCallsActions(opts: UseCallsActionsOptions) {
  const { items, tags, total } = opts
  const dataType = DataType.CALL

  const callId = ref('')
  const { mutate: mutateCall, loading: callLoading } = initMutation({ document: callGQL })

  function call(item: ICall) {
    callId.value = item.id
    mutateCall({ number: item.number })
  }

  function addItemToTags(item: ICall) {
    openModal(UpdateTagRelationsModal, {
      type: dataType,
      tags: tags.value,
      item: { key: item.id, title: '', size: 0 },
      selected: tags.value.filter((it) => item.tags.some((t: ITag) => t.id === it.id)),
    })
  }

  function deleteItem(item: ICall) {
    openModal(DeleteConfirm, {
      id: item.id,
      name: item.number,
      gql: deleteCallsGQL,
      variables: () => ({ query: `ids:${item.id}` }),
      typeName: 'Call',
      done: () => {
        items.value = items.value.filter((it) => it.id !== item.id)
        total.value--
        if (item.tags.length) emitter.emit('refetch_tags', dataType)
        emitter.emit('calls_deleted')
      },
    })
  }

  return { callId, callLoading, call, addItemToTags, deleteItem }
}
