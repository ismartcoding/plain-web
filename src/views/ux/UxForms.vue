<template>
  <section class="ux-section">
    <h2>Form Elements</h2>

    <ux-code-block code="<v-text-field v-model=&quot;text&quot; label=&quot;Label&quot; />">
      <v-text-field v-model="text" label="Label" />
    </ux-code-block>

    <ux-code-block code="<v-text-field v-model=&quot;text&quot; placeholder=&quot;Placeholder&quot; />">
      <v-text-field v-model="text2" placeholder="Enter something..." />
    </ux-code-block>

    <ux-code-block code="<v-text-field v-model=&quot;text&quot; error error-text=&quot;Required field&quot; />">
      <v-text-field v-model="text3" label="With Error" error error-text="This field is required" />
    </ux-code-block>

    <ux-code-block code="<v-text-field v-model=&quot;text&quot; type=&quot;textarea&quot; :rows=&quot;3&quot; label=&quot;Textarea&quot; />">
      <v-text-field v-model="textarea" type="textarea" :rows="3" label="Textarea" />
    </ux-code-block>

    <ux-code-block :code="selectCode">
      <v-select v-model="selected" label="Select" :options="selectOptions" />
    </ux-code-block>

    <ux-code-block code="<v-checkbox v-model=&quot;checked&quot; />">
      <v-checkbox v-model="checked" /> <span>Checkbox ({{ checked ? 'checked' : 'unchecked' }})</span>
    </ux-code-block>

    <ux-code-block code="<v-checkbox indeterminate />">
      <v-checkbox indeterminate /> <span>Indeterminate</span>
    </ux-code-block>

    <h3>CSS: .form-row / .form-label</h3>
    <ux-code-block code="<div class=&quot;form-row&quot;>&#10;  <div><label class=&quot;form-label&quot;>Name</label>&#10;    <v-text-field ... /></div>&#10;  <div><label class=&quot;form-label&quot;>Email</label>&#10;    <v-text-field ... /></div>&#10;</div>">
      <div class="form-row" style="width: 100%">
        <div>
          <label class="form-label">Name</label>
          <v-text-field v-model="formName" placeholder="Name" />
        </div>
        <div>
          <label class="form-label">Email</label>
          <v-text-field v-model="formEmail" placeholder="Email" />
        </div>
      </div>
    </ux-code-block>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import UxCodeBlock from './UxCodeBlock.vue'

const text = ref('')
const text2 = ref('')
const text3 = ref('')
const textarea = ref('')
const selected = ref('')
const checked = ref(false)
const formName = ref('')
const formEmail = ref('')

const selectOptions = [
  { label: 'Option 1', value: '1' },
  { label: 'Option 2', value: '2' },
  { label: 'Option 3', value: '3' },
]

const selectCode = `<v-select v-model="val" label="Select" :options="[
  { label: 'Option 1', value: '1' },
  { label: 'Option 2', value: '2' },
]" />`
</script>
