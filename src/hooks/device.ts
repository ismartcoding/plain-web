import { ref } from 'vue'

const isPhone = ref(window.innerWidth <= 480)
const isTablet = ref(window.innerWidth <= 768)

function update() {
  isPhone.value = window.innerWidth <= 480
  isTablet.value = window.innerWidth <= 768
}

window.addEventListener('resize', update)

export function getIsTablet() {
  return isTablet
}

export function getIsPhone() {
  return isPhone
}