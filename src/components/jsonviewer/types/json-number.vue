<script>
import { h } from 'vue'
export default {
  props: {
    jsonValue: {
      type: Number,
      required: true,
    },
  },
  setup(props) {
    const isInteger = Number.isInteger(props.jsonValue)

    return () =>
      h('span', {
        class: {
          'jv-item': true,
          'jv-number': true,
          'jv-number-integer': isInteger,
          'jv-number-float': !isInteger,
        },
        innerText: props.jsonValue.toString(),
      })
  },
}
</script>
