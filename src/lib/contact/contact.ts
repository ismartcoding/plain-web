function getTypes(length: number) {
  return Array.from({ length }, (_, i) => i + 1).concat(-1)
}

export const types = {
  phoneNumberTypes: getTypes(20),
  emailTypes: getTypes(4),
  addressTypes: getTypes(3),
  eventTypes: getTypes(3),
  imTypes: getTypes(8),
  websiteTypes: getTypes(7),
}
