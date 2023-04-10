<template>
  <div class="chat-section" v-if="result && result.latestExchangeRates">
    <div class="list-item">
      <span class="key">{{ t('exchange.data_date') }} {{ result.latestExchangeRates.date }}</span>
      <span class="value"></span>
    </div>
    <div class="list-item" v-for="item in rates" :key="item.k">
      <span class="key">{{ item.k }}</span>
      <span class="value">{{ getValue(item.k, item.v) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { initQuery, latestExchangeRatesGQL } from '@/lib/api/query'
const { t } = useI18n()

const { result } = initQuery({
  handle: () => {},
  document: latestExchangeRatesGQL,
  variables: {
    live: false,
  },
  appApi: true,
})

const props = defineProps({
  data: { type: Object },
})

const rates = computed(() => {
  const selected = props.data?._content?.value?.selected ?? []
  const rates =
    result?.value?.latestExchangeRates?.rates?.filter((it: { k: string }) => selected.indexOf(it.k) !== -1) ?? []

  const items: any[] = []
  for (const k of selected) {
    const rate = rates.find((it: { k: string }) => it.k === k)
    if (rate) {
      items.push(rate)
    }
  }
  return items
})

const baseRate = computed((): number => {
  const base = props.data?._content?.value?.base ?? 1.0
  return result?.value?.latestExchangeRates?.rates?.find((it: { k: any }) => it.k === base)?.v ?? 1.0
})

function getValue(k: string, v: number): string {
  const value = props.data?._content?.value?.value ?? 1.0
  const r = (value * v) / baseRate.value

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: k,
  }).format(r)
}
</script>

<style lang="scss" scoped></style>
