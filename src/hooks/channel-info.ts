import { ref, computed } from 'vue'
import type { IChatChannel, IPeer } from '@/lib/interfaces'
import { popModal, openModal } from '@/components/modal'
import { initMutation, deleteChatChannelGQL, leaveChatChannelGQL, addChatChannelMemberGQL, removeChatChannelMemberGQL } from '@/lib/api/mutation'
import RenameChannelModal from '@/views/chat/RenameChannelModal.vue'

export function useChannelInfo(props: {
  channel: IChatChannel
  peers: IPeer[]
  selfId: string
  onClear: () => Promise<void>
  onDeleted: () => void
  onMemberUpdated: () => void
}) {
  const channel = ref({ ...props.channel })
  const confirmAction = ref('')
  const actionLoading = ref(false)

  const isOwner = computed(() => channel.value.owner === 'me')
  const memberIds = computed(() => new Set(channel.value.members.map((m) => m.id)))
  const availablePeers = computed(() => props.peers.filter((p) => p.status === 'paired' && !memberIds.value.has(p.id)))

  function getMemberName(peerId: string) {
    if (peerId === props.selfId) return 'Me'
    return props.peers.find((p) => p.id === peerId)?.name ?? peerId.substring(0, 8)
  }

  function getOwnerName() {
    return props.peers.find((p) => p.id === channel.value.owner)?.name ?? channel.value.owner.substring(0, 8)
  }

  const { mutate: mutateDelete, onDone: onDeleteDone } = initMutation({ document: deleteChatChannelGQL })
  const { mutate: mutateLeave, onDone: onLeaveDone } = initMutation({ document: leaveChatChannelGQL })
  const { mutate: mutateAddMember, onDone: onAddMemberDone } = initMutation({ document: addChatChannelMemberGQL })
  const { mutate: mutateRemoveMember, onDone: onRemoveMemberDone } = initMutation({ document: removeChatChannelMemberGQL })

  onAddMemberDone((r: any) => { if (r.data?.addChatChannelMember) channel.value = { ...r.data.addChatChannelMember }; props.onMemberUpdated() })
  onRemoveMemberDone((r: any) => { if (r.data?.removeChatChannelMember) channel.value = { ...r.data.removeChatChannelMember }; props.onMemberUpdated() })
  onDeleteDone(() => { props.onDeleted(); popModal() })
  onLeaveDone(() => { props.onDeleted(); popModal() })

  async function doConfirmedAction() {
    actionLoading.value = true
    try {
      if (confirmAction.value === 'delete') mutateDelete({ id: channel.value.id })
      else if (confirmAction.value === 'leave') mutateLeave({ id: channel.value.id })
      else if (confirmAction.value === 'clear') { await props.onClear(); popModal() }
    } finally { actionLoading.value = false }
  }

  function addMember(peerId: string) { mutateAddMember({ id: channel.value.id, peerId }) }
  function removeMember(peerId: string) { mutateRemoveMember({ id: channel.value.id, peerId }) }
  function openRename() { openModal(RenameChannelModal, { channel: channel.value }) }
  function close() { popModal() }

  return {
    channel, confirmAction, actionLoading,
    isOwner, availablePeers,
    getMemberName, getOwnerName, doConfirmedAction,
    addMember, removeMember, openRename, close,
  }
}
