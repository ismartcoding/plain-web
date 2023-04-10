<script>
import { h } from 'vue'
export default {
  props: {
    jsonValue: {
      type: Function,
      required: true,
    },
  },
  setup(props) {
    return () =>
      h('span', {
        class: {
          'jv-item': true,
          'jv-function': true,
        },
        attrs: {
          title: props.jsonValue.toString(),
        },
        innerHTML: '&lt;function&gt;',
      })
  },
}
</script>
