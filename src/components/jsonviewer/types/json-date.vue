<script>
import { h } from 'vue'
export default {
  props: {
    jsonValue: {
      type: Date,
      required: true,
    },
  },
  setup(props) {
    const value = props.jsonValue

    return () =>
      h('span', {
        class: {
          'jv-item': true,
          'jv-string': true,
        },
        innerText: `"${value.toLocaleString()}"`,
      })
  },
}
</script>
