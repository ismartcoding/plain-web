import type { PropType } from 'vue'

export const VirtualProps = {
  dataKey: {
    type: [String, Function],
    required: true,
  },
  dataSources: {
    type: Array,
    required: true,
    default: () => [],
  },
  keeps: {
    type: Number,
    default: 30,
  },
  estimateSize: {
    type: Number,
    default: 50,
  },

  direction: {
    type: String as PropType<'vertical' | 'horizontal'>,
    default: 'vertical', // the other value is horizontal
  },
  start: {
    type: Number,
    default: 0,
  },
  offset: {
    type: Number,
    default: 0,
  },
  topThreshold: {
    type: Number,
    default: 0,
  },
  bottomThreshold: {
    type: Number,
    default: 0,
  },
  pageMode: {
    type: Boolean,
    default: false,
  },
}

export const ItemProps = {
  index: {
    type: Number,
  },
  event: {
    type: String,
  },
  horizontal: {
    type: Boolean,
  },
  source: {
    type: Object,
  },
  component: {
    type: Function,
  },
  uniqueKey: {
    type: [String, Number],
  },
}

export const SlotProps = {
  event: {
    type: String,
  },
  uniqueKey: {
    type: String,
  },
  horizontal: {
    type: Boolean,
  },
}
