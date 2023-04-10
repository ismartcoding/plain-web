import { modalQueue } from './utils/state'
import onBeforeModalClose from './onBeforeModalClose'
import Modal from './utils/Modal'
import useModalRouter from './router'
import { closeModal, popModal, pushModal, openModal, promptModal, getCurrentModal, closeById } from './methods'
export {
  Modal,
  closeModal,
  popModal,
  pushModal,
  openModal,
  promptModal,
  modalQueue,
  onBeforeModalClose,
  useModalRouter,
  getCurrentModal,
  closeById,
}
