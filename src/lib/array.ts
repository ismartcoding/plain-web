export function deleteById(items: [{ id: string }], id: string) {
  const index = items.findIndex((it: { id: string }) => it.id === id)
  if (index !== -1) {
    items.splice(index, 1)
  }
}
