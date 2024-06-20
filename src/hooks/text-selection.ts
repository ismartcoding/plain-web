export function fixUserSelect(event: MouseEvent) {
  if (event.detail > 1) {
    event.preventDefault()
  }
}
