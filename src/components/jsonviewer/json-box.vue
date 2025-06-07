<script>
import JsonString from './types/json-string.vue'
import JsonUndefined from './types/json-undefined.vue'
import JsonNumber from './types/json-number.vue'
import JsonBoolean from './types/json-boolean.vue'
import JsonObject from './types/json-object.vue'
import JsonArray from './types/json-array.vue'
import JsonFunction from './types/json-function.vue'
import JsonDate from './types/json-date.vue'
import JsonRegexp from './types/json-regexp.vue'
import { h } from 'vue'
export default {
  name: 'JsonBox',
  props: {
    value: {
      type: [Object, Array, String, Number, Boolean, Function, Date],
      default: null,
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
  },
  data() {
    return {
      expand: true,
    }
  },
  mounted() {
    this.expand = this.depth >= this.expandDepth ? false : true
  },
  methods: {
    toggle() {
      this.expand = !this.expand

      try {
        this.$el.dispatchEvent(new Event('resized'))
      } catch (e) {
        console.error(e)
      }
    },
  },
  render() {
    let dataType

    if (this.value === null || this.value === undefined) {
      dataType = JsonUndefined
    } else if (Array.isArray(this.value)) {
      dataType = JsonArray
    } else if (Object.prototype.toString.call(this.value) === '[object Date]') {
      dataType = JsonDate
    } else if (typeof this.value === 'object') {
      dataType = JsonObject
    } else if (typeof this.value === 'number') {
      dataType = JsonNumber
    } else if (typeof this.value === 'string') {
      dataType = JsonString
    } else if (typeof this.value === 'boolean') {
      dataType = JsonBoolean
    } else if (typeof this.value === 'function') {
      dataType = JsonFunction
    }
    if (this.value && this.value.constructor === RegExp) {
      dataType = JsonRegexp
    }

    let complex = false
    if (this.keyName && this.value) {
      if (Array.isArray(this.value) && this.value.length) {
        complex = true
      } else if (typeof this.value === 'object') {
        const v = Object.prototype.toString.call(this.value)
        if (!['[]', '[object Date]'].includes(v) && Object.keys(this.value).length) {
          complex = true
        }
      }
    }

    const elements = []
    if (complex) {
      elements.push(
        h('span', {
          class: {
            'jv-toggle': true,
            open: this.expand,
          },
          onClick: this.toggle,
        })
      )
    }

    if (this.keyName) {
      elements.push(
        h('span', {
          class: {
            'jv-key': true,
          },
          onClick: () => {
            console.log(this.keyName)
          },
          innerText: `${this.keyName}:`,
        })
      )
    }

    elements.push(
      h(dataType, {
        class: {
          'jv-push': true,
        },
        jsonValue: this.value,
        keyName: this.keyName,
        depth: this.depth,
        expand: this.expand,
        expandDepth: this.expandDepth,
        'onUpdate:expand': (value) => {
          this.expand = value
        },
      })
    )

    return h(
      'div',
      {
        class: {
          'jv-node': true,
          'jv-key-node': Boolean(this.keyName) && !complex,
          toggle: complex,
        },
      },
      elements
    )
  },
}
</script>

<style>
.jv-node {
  position: relative;
}

.jv-node:after {
  content: ',';
}

.jv-node:last-of-type:after {
  content: '';
}

.jv-node.toggle {
  margin-left: 13px !important;
}

.jv-node .jv-node {
  margin-left: 25px;
}
</style>
