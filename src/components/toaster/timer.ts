export default class Timer {
  startedAt: number
  callback: TimerHandler
  delay: number
  timer: number
  constructor(callback: TimerHandler, delay: number) {
    this.startedAt = Date.now()
    this.callback = callback
    this.delay = delay

    this.timer = setTimeout(callback, delay)
  }

  pause() {
    this.stop()
    this.delay -= Date.now() - this.startedAt
  }

  resume() {
    this.stop()
    this.startedAt = Date.now()
    this.timer = setTimeout(this.callback, this.delay)
  }

  stop() {
    clearTimeout(this.timer)
  }
}
