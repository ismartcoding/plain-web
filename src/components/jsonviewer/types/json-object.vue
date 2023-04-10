<script>
import JsonBox from '../json-box.vue'
import { h } from 'vue'
export default {
  name: 'JsonObject',
  props: {
    jsonValue: {
      type: Object,
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
  data() {
    return {
      value: {},
    }
  },
  computed: {
    ordered() {
      const ordered = {}
      Object.keys(this.value)
        .sort()
        .forEach((key) => {
          ordered[key] = this.value[key]
        })
      return ordered
    },
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
    setValue(val) {
      setTimeout(() => {
        this.value = val
      }, 0)
    },
    toggle() {
      this.$emit('update:expand', !this.expand)
      this.dispatchEvent()
    },
    dispatchEvent() {
      try {
        this.$el.dispatchEvent(new Event('resized'))
      } catch (e) {}
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
          'jv-object': true,
        },
        innerText: '{',
      })
    )

    if (this.expand) {
      for (const key in this.ordered) {
        if (this.ordered.hasOwnProperty(key)) {
          const value = this.ordered[key]

          elements.push(
            h(JsonBox, {
              key,
              style: {
                display: !this.expand ? 'none' : undefined,
              },
              keyName: key,
              expandDepth: this.expandDepth,
              depth: this.depth + 1,
              value,
            })
          )
        }
      }
    }

    if (!this.expand && Object.keys(this.value).length) {
      elements.push(
        h('span', {
          style: {
            display: this.expand ? 'none' : undefined,
          },
          class: {
            'jv-ellipsis': true,
          },
          onClick: this.toggle,
          title: `click to reveal object content (keys: ${Object.keys(this.ordered).join(', ')})`,
          innerText: '...',
        })
      )
    }

    elements.push(
      h('span', {
        class: {
          'jv-item': true,
          'jv-object': true,
        },
        innerText: '}',
      })
    )

    return h('span', elements)
  },
}
</script>
