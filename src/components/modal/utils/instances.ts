import { state } from './state'
import type { ModalComponentInterface } from './types'

export function saveInstance(id: number, instance: ModalComponentInterface) {
  state.instanceStorage[id] = instance
}
export function getInstance(id: number) {
  return state.instanceStorage[id]
}
