import { ref, type Ref } from 'vue'
import type { ICall, ITag } from '@/lib/interfaces'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import gql from 'graphql-tag'
import { callGQL, initMutation } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'
import { DataType } from '@/lib/data'

interface UseCallsActionsOptions {
  tags: Ref<ITag[]>
  total: Ref<number>
}

export function useCallsActions(opts: UseCallsActionsOptions) {
  const { tags, total } = opts
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
      gql: gql`
        mutation DeleteCall($query: String!) {
          deleteCalls(query: $query)
        }
      `,
      variables: () => ({ query: `ids:${item.id}` }),
      typeName: 'Call',
      done: () => {
        total.value--
        if (item.tags.length) emitter.emit('refetch_tags', dataType)
        emitter.emit('calls_deleted')
      },
    })
  }

  return { callId, callLoading, call, addItemToTags, deleteItem }
}
