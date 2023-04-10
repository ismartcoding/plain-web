import { ref } from 'vue'
import type Modal from './Modal'
import type { ModalComponentInterface } from './types'

const modalQueue = ref<Modal[]>([]) //All modals that showing now

interface InstancesStorageInterface {
  [index: number]: ModalComponentInterface
}

interface StateInterface {
  initialized: boolean
  instanceStorage: InstancesStorageInterface
}

const state: StateInterface = {
  initialized: false,
  instanceStorage: {},
}

export { modalQueue, state }
