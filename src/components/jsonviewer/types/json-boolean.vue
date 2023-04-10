<script>
import { h } from 'vue'
export default {
  props: {
    jsonValue: Boolean,
  },
  setup(props) {
    return () =>
      h('span', {
        class: {
          'jv-item': true,
          'jv-boolean': true,
        },
        innerText: props.jsonValue.toString(),
      })
  },
}
</script>
