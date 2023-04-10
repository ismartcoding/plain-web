<script>
import { h } from 'vue'
export default {
  props: {
    jsonValue: {
      type: Object,
      default: null,
    },
  },
  setup(props) {
    return () =>
      h('span', {
        class: {
          'jv-item': true,
          'jv-undefined': true,
        },
        innerText: props.jsonValue === null ? 'null' : 'undefined',
      })
  },
}
</script>
