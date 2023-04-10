import { modalQueue } from './utils/state'
import Modal, { type ModalOptions } from './utils/Modal'
import { state } from './utils/state'
import ModalError from './utils/ModalError'
import { markRaw } from 'vue'
import { DtoEventClose, type IEventClose } from './utils/event-close'
import guards, { guardToPromiseFn, runGuardQueue } from './utils/guards'
import type { GuardFunction } from './utils/types'

function _addModal(component: any, params: any, options: Partial<ModalOptions>): Modal {
  if (!state.initialized) throw ModalError.NotInitialized()

  if (!component) throw ModalError.ModalComponentNotProvided()

  const modal = new Modal(component, params, options)

  modalQueue.value.push(markRaw(modal))

  return modal
}

export function closeById(id: number, options: Partial<IEventClose> = {}) {
  const indexRemoveElement: number = modalQueue.value.findIndex((item: Modal) => item.id === id)

  //Modal with id not found
  if (indexRemoveElement === -1) return Promise.reject(ModalError.Undefined(id))

  const arr = guards.get(id, 'close').map((guard: GuardFunction) => guardToPromiseFn(guard, id, DtoEventClose(options)))

  return runGuardQueue(arr).then(() => {
    modalQueue.value.splice(indexRemoveElement, 1)

    delete state.instanceStorage[id]
    guards.delete(id)
  })
}

export function pushModal(component: any, props: any = {}, options: Partial<ModalOptions> = {}): Promise<Modal> {
  return Promise.resolve().then(() => _addModal(component, props, options))
}

export function closeModal(): Promise<void> {
  return runGuardQueue(modalQueue.value.map((modalObject: Modal) => () => modalObject.close()))
}

export function getCurrentModal() {
  if (modalQueue.value.length === 0) return undefined

  return modalQueue.value[modalQueue.value.length - 1]
}

export function openModal(component: any, props: any = {}, options: Partial<ModalOptions> = {}): Promise<Modal> {
  return closeModal()
    .then(() => {
      if (modalQueue.value.length) throw ModalError.QueueNoEmpty()
    })
    .then(() => pushModal(component, props, options))
}

export function popModal(): Promise<void> {
  const modal = getCurrentModal()
  if (!modal) return Promise.resolve()
  return modal.close()
}

export async function promptModal<T>(component: any, options: any = {}): Promise<T> {
  const modal = await pushModal(component, options)

  return new Promise((resolve) => {
    modal.on(Modal.EVENT_PROMPT, async (data) => {
      await modal.close()
      resolve(data)
    })
  })
}
