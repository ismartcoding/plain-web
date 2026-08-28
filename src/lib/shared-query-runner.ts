export function createSharedQueryRunner(run: (force: boolean) => Promise<void>) {
  let inFlight: Promise<void> | undefined
  let inFlightForced = false

  function execute(force: boolean): Promise<void> {
    if (inFlight && (!force || inFlightForced)) return inFlight
    const request = run(force)
    inFlight = request
    inFlightForced = force
    void request.finally(() => {
      if (inFlight === request) {
        inFlight = undefined
        inFlightForced = false
      }
    })
    return request
  }

  return { execute }
}
