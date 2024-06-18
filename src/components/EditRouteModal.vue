<template>
  <md-dialog>
    <div slot="headline">
      {{ data ? $t('edit') : $t('create') }}
    </div>
    <div slot="content">
      <div class="row mb-3">
        <label class="col-md-3 col-form-label">{{ $t('traffic_to') }}</label>
        <div class="col-md-9">
          <select class="form-select" v-model="targetType">
            <option v-for="item of targetTypes" :key="item" :value="item">
              {{ $t(`target_type.${item}`) }}
            </option>
          </select>
          <div class="input-group" v-if="Target.hasInput(targetType)">
            <input type="text" class="form-control" v-model="targetValue" :placeholder="$t('for_example') + ' ' + Target.hint(targetType)" />
            <popper class="input-group-text">
              <span class="inner">
                <i-material-symbols:question-mark-rounded />
              </span>
              <template #content>
                <pre class="help-block">{{ $t(`examples_${targetType}`) }}</pre>
              </template>
            </popper>
          </div>
          <select class="form-select" v-model="targetValue" v-if="targetType === TargetType.INTERFACE">
            <option value="">{{ $t('all_local_networks') }}</option>
            <option v-for="item of networks?.filter((it: any) => it.type !== 'wan')" :value="item.ifName">
              {{ item.name }}
            </option>
          </select>
          <div class="invalid-feedback" v-if="valueError">
            {{ valueError ? $t(valueError) : '' }}
          </div>
        </div>
      </div>
      <div class="row mb-3">
        <label class="col-md-3 col-form-label">{{ t('route_via') }}</label>
        <div class="col-md-9">
          <select class="form-select" v-model="editItem.if_name">
            <option v-for="item of networks?.filter((it: any) => ['wan', 'vpn'].includes(it.type))" :key="item.ifName" :value="item.ifName">
              {{ item.name }}
            </option>
          </select>
        </div>
      </div>
      <div class="row mb-3">
        <label class="col-md-3 col-form-label">{{ t('apply_to') }}</label>
        <div class="col-md-9">
          <select class="form-select" v-model="editItem.apply_to">
            <option value="all">{{ $t('all_devices') }}</option>
            <option v-for="item of networks?.filter((it: any) => !['wan', 'vpn'].includes(it.type))" :key="item.ifName" :value="'iface:' + item.ifName">
              {{ item.name }}
            </option>
            <option v-for="item of devices" :value="'mac:' + item.mac">
              {{ item.name }}
            </option>
          </select>
        </div>
      </div>
      <div class="row mb-3">
        <label class="col-md-3 col-form-label">{{ t('notes') }}</label>
        <div class="col-md-9">
          <textarea class="form-control" v-model="editItem.notes" rows="3"></textarea>
        </div>
      </div>
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="save" :disabled="createLoading || editLoading" @click="doAction" autofocus>
        <md-circular-progress indeterminate v-if="createLoading || editLoading" slot="icon" /> {{ $t('save') }}
      </md-filled-button>
    </div>
  </md-dialog>
</template>
<script setup lang="ts">
import { initMutation, insertCache } from '@/lib/api/mutation'
import { TargetType, Target } from '@/lib/target'
import { useField, useForm } from 'vee-validate'
import { reactive, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApolloCache, gql } from '@apollo/client/core'
import { string } from 'yup'
import { configFragment } from '@/lib/api/fragments'
import { popModal } from './modal'

const { handleSubmit } = useForm()

const editItem = reactive({
  if_name: '',
  apply_to: 'all',
  notes: '',
  target: '',
  is_enabled: true,
})

const targetType = ref(TargetType.INTERNET)
const targetTypes = Object.values(TargetType).filter((it) => [TargetType.IP, TargetType.NET, TargetType.REMOTE_PORT, TargetType.INTERNET].includes(it))

const { t } = useI18n()

const props = defineProps({
  data: { type: Object },
  devices: { type: Array as PropType<any[]> },
  networks: { type: Array as PropType<any[]> },
})

const {
  mutate: create,
  loading: createLoading,
  onDone: createDone,
} = initMutation({
  document: gql`
    mutation createConfig($input: ConfigInput!) {
      createConfig(input: $input) {
        ...ConfigFragment
      }
    }
    ${configFragment}
  `,
  options: {
    update: (cache: ApolloCache<any>, data: any) => {
      insertCache(
        cache,
        data.data.createConfig,
        gql`
          query {
            configs {
              ...ConfigFragment
            }
          }
          ${configFragment}
        `
      )
    },
  },
})
const {
  mutate: edit,
  loading: editLoading,
  onDone: editDone,
} = initMutation({
  document: gql`
    mutation updateConfig($id: ID!, $input: ConfigInput!) {
      updateConfig(id: $id, input: $input) {
        ...ConfigFragment
      }
    }
    ${configFragment}
  `,
})

const {
  value: targetValue,
  resetField,
  errorMessage: valueError,
} = useField(
  'inputValue',
  string()
    .test(
      'required',
      (d) => 'valid.required',
      (value) => !Target.hasInput(targetType.value) || !!value
    )
    .test(
      'target-value',
      (d) => 'invalid_value',
      (value) => Target.isValid(targetType.value, value ?? '')
    )
)

const data = props.data?.data
targetType.value = props.data?.target?.type ?? TargetType.INTERNET
targetValue.value = props.data?.target?.value ?? ''
editItem.apply_to = props.data?.applyTo?.toValue() ?? 'all'
editItem.if_name = data?.if_name ?? props.networks?.[0]?.ifName ?? ''
editItem.notes = data?.notes ?? ''
editItem.is_enabled = data?.is_enabled ?? true
if (!data) {
  resetField()
}

watch(targetType, (n, o) => {
  if (n === TargetType.INTERFACE || o === TargetType.INTERFACE) {
    targetValue.value = ''
  }
})

const doAction = handleSubmit(() => {
  const target = new Target()
  target.type = targetType.value
  target.value = targetValue.value ?? ''
  editItem.target = target.toValue()
  if (props.data) {
    edit({ id: props.data.id, input: { group: 'route', value: JSON.stringify(editItem) } })
  } else {
    create({ input: { group: 'route', value: JSON.stringify(editItem) } })
  }
})

createDone(() => {
  popModal()
})

editDone(() => {
  popModal()
})
</script>
