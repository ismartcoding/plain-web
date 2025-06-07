<script lang="ts">
import JsonBox from '../json-box.vue'
import { h } from 'vue'

export default {
  name: 'JsonArray',
  props: {
    jsonValue: {
      type: Array,
      required: true,
    },
    expandDepth: {
      type: Number,
      default: 1,
    },
    keyName: {
      type: String,
      default: '',
    },
    depth: {
      type: Number,
      default: 0,
    },
    expand: Boolean,
  },
emits: ['update:expand'],
  data() {
    return {
      value: [] as any[],
    }
  },
  watch: {
    jsonValue(newVal) {
      this.setValue(newVal)
    },
  },
  mounted() {
    this.setValue(this.jsonValue)
  },
  methods: {
    setValue(vals: any[], index = 0) {
      if (index === 0) {
        this.value = []
      }
      setTimeout(() => {
        if (vals.length > index) {
          this.value.push(vals[index])
          this.setValue(vals, index + 1)
        }
      }, 0)
    },
    toggle() {
      this.$emit('update:expand', !this.expand)

      try {
        this.$el.dispatchEvent(new Event('resized'))
      } catch (e) {
        console.error(e)
      }
    },
  },
  render() {
    const elements = []

    if (!this.keyName) {
      elements.push(
        h('span', {
          class: {
            'jv-toggle': true,
            open: !!this.expand,
          },
          onClick: this.toggle,
        })
      )
    }

    elements.push(
      h('span', {
        class: {
          'jv-item': true,
          'jv-array': true,
        },
        innerText: '[',
      })
    )

    const n = this.value.length
    if (n > 0) {
      elements.push(
        h('span', {
          class: {
            'jv-ellipsis': true,
          },
          onClick: this.toggle,
          innerText: n == 1 ? '1 item' : `${n} items`,
        })
      )
    }

    if (this.expand) {
      this.value.forEach((value, key) => {
        elements.push(
          h(JsonBox, {
            key,
            style: {
              display: this.expand ? undefined : 'none',
            },
            expandDepth: this.expandDepth,
            depth: this.depth + 1,
            value,
          })
        )
      })
    }

    elements.push(
      h('span', {
        class: {
          'jv-item': true,
          'jv-array': true,
        },
        innerText: ']',
      })
    )

    return h('span', elements)
  },
}
</script>
