<template>
  <div class="dev-table-wrap">
    <table class="dev-table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col">{{ col }}</th>
          <th v-if="debug" class="col-action" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i">
          <td v-for="col in columns" :key="col" class="cell">
            <field-id :id="display(row[col])" :raw="String(row[col] ?? '')" />
          </td>
          <td v-if="debug" class="col-action">
            <v-icon-button
              v-tooltip="$t('delete')"
              class="delete-btn"
              :loading="deletingKey === String(row[rowKey] ?? '')"
              @click="emit('delete', String(row[rowKey] ?? ''))"
            >
              <i-lucide:trash-2 />
            </v-icon-button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
const TRUNCATE_LEN = 60

withDefaults(
  defineProps<{
    columns: string[]
    rows: Record<string, string | null>[]
    rowKey?: string
    debug?: boolean
    deletingKey?: string
  }>(),
  {
    rowKey: 'id',
    debug: false,
    deletingKey: '',
  },
)

const emit = defineEmits<{
  delete: [key: string]
}>()

function display(val: string | null | undefined): string {
  const s = val ?? ''
  return s.length > TRUNCATE_LEN ? s.slice(0, TRUNCATE_LEN) + '…' : s
}
</script>

<style lang="scss" scoped>
.dev-table-wrap {
  background: var(--md-sys-color-surface-container-lowest);
  border-radius: 12px;
  overflow: auto;
}

.dev-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;

  thead {
    background: var(--md-sys-color-surface-container-low);
    position: sticky;
    top: 0;
    z-index: 1;

    th {
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      color: var(--md-sys-color-on-surface-variant);
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      white-space: nowrap;
    }
  }

  tbody tr {
    border-bottom: 1px solid var(--md-sys-color-outline-variant);

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: var(--md-sys-color-surface-container);
    }
  }

  .cell {
    padding: 8px 12px;
    vertical-align: middle;
    max-width: 240px;
    overflow: hidden;
    font-family: monospace;
    color: var(--md-sys-color-on-surface);
  }

  .col-action {
    width: 40px;
    text-align: center;
    padding: 4px;
  }
}

.delete-btn {
  opacity: 0.5;

  &:hover {
    opacity: 1;
    color: var(--md-sys-color-error);
  }
}
</style>
