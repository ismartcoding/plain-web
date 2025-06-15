import { ref } from 'vue'

const isPhone = ref(window.innerWidth <= 480)

function update() {
  isPhone.value = window.innerWidth <= 480
}

window.addEventListener('resize', update)

export function getIsPhone() {
  return isPhone
}