import { type Component, computed, type ComputedRef, reactive, ref, type Ref } from 'vue'
import { modalQueue } from './state'
import guards from './guards'
import type { GuardFunction } from './types'
import { getInstance } from './instances'
import DtoModalOptions from './dto-modal-options'
import { closeById } from '../methods'

export interface ModalOptions {
  backgroundClose: boolean
  isRoute: boolean
}

export default class Modal {
  /**
   * @description Unique id of each modal window.
   * */
  public id: number
  events = reactive<Record<string, EventCallback[]>>({})
  /**
   * @description Computed value. True - when the modal was closed.
   * */
  public closed: ComputedRef

  /**
   * @description VueComponent that will be mounted like modal.
   * */
  public component: Component

  /**
   * @description Props for VueComponent.
   * */
  public props: Ref

  protected static modalId = 0

  /**
   * @description Click on the background will close modal windows.
   * */
  public backgroundClose = true

  /**
   * @description If modal was opened like Route instance (useModalRouter) the value is true, otherwise false.
   */
  public readonly isRoute: boolean = false

  /**
   * @description Event using for promptModal.
   */
  public static readonly EVENT_PROMPT = 'vue-modal:____P____R____O____M____P____T'

  constructor(component: Component | any, props: any, options: Partial<ModalOptions>) {
    this.id = Modal.modalId++
    this.component = component

    this.props = ref(props)

    this.closed = computed(() => !modalQueue.value.includes(this))

    if (component.beforeModalClose) guards.add(this.id, 'close', component.beforeModalClose)

    const dtoOptions = DtoModalOptions(options)
    this.backgroundClose = dtoOptions.backgroundClose
    this.isRoute = dtoOptions.isRoute
  }

  /**
   * @description Method for closing the modal window
   * */
  public close(): Promise<void> {
    return closeById(this.id)
  }

  /**
   * @description Hook for handling modal closing
   * */
  public set onclose(func: GuardFunction) {
    guards.add(this.id, 'close', func)
  }
  /**
   * @description Return instance of modal component
   * */
  public get instance() {
    return getInstance(this.id)
  }

  /**
   * @description Method for handle default events from VueComponent.
   * */
  public on(eventName: string, callback: EventCallback) {
    if (!Array.isArray(this.events[eventName])) this.events[eventName] = []

    this.events[eventName].push(callback)

    return () => {
      const index = this.events[eventName].indexOf(callback)
      if (index === -1) return // Callback not founded
      this.events[eventName].splice(index, 1)
    }
  }
}

export type EventCallback = (v: any) => any
