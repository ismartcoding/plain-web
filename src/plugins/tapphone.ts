import emitter from '@/plugins/eventbus'

export default (message: string) => {
  emitter.emit('tap_phone', message)
}
