<script lang="ts">
import ContainerModalItem from './ModalContainerItem.vue'
import initialize from './utils/initialize'
import { h, onMounted, TransitionGroup } from 'vue'
import { modalQueue } from './utils/state'
import { configuration } from './utils/config'

export default {
  setup() {
    onMounted(initialize)

    return () => {
      return h(
        TransitionGroup,
        { name: configuration.animation },
        {
          default: () =>
            modalQueue.value.map((modalObject) => {
              return h(ContainerModalItem, {
                key: modalObject.id,
                id: modalObject.id,
              })
            }),
        }
      )
    }
  },
  components: { ContainerModalItem },
}
</script>
