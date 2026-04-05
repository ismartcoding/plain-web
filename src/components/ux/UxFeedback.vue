<template>
  <section class="ux-section">
    <h2>Feedback &amp; Progress</h2>

    <ux-code-block code="<v-circular-progress indeterminate />&#10;<v-circular-progress indeterminate class=&quot;sm&quot; />">
      <v-circular-progress indeterminate />
      <v-circular-progress indeterminate class="sm" />
      <span style="font-size: 0.8rem; color: var(--md-sys-color-on-surface-variant)">default / .sm</span>
    </ux-code-block>

    <ux-code-block code="<v-circular-progress indeterminate class=&quot;primary&quot; />&#10;<v-circular-progress indeterminate class=&quot;error&quot; />">
      <v-circular-progress indeterminate class="primary" />
      <v-circular-progress indeterminate class="secondary" />
      <v-circular-progress indeterminate class="error" />
    </ux-code-block>

    <ux-code-block code="<progress-card label-html=&quot;Uploading <b>file.zip</b>&quot; :value=&quot;65&quot; />">
      <progress-card label-html="Uploading <b>file.zip</b>" :value="65" />
    </ux-code-block>

    <h3>CSS: .progress-track / .progress-fill</h3>
    <ux-code-block code="<div class=&quot;progress-track&quot;>&#10;  <div class=&quot;progress-fill&quot; :style=&quot;{ width: '60%' }&quot; />&#10;</div>">
      <div style="width: 100%">
        <div class="progress-track">
          <div class="progress-fill" style="width: 60%"></div>
        </div>
      </div>
    </ux-code-block>

    <h3>&lt;danger-action&gt;</h3>
    <ux-code-block code="<danger-action label=&quot;Delete account&quot; confirm-text=&quot;Are you sure?&quot; @confirm=&quot;...&quot; />">
      <div style="width: 100%">
        <danger-action label="Delete account" confirm-text="Are you sure?" @confirm="() => {}" />
      </div>
    </ux-code-block>

    <h3>CSS: .alert-danger / .alert-info / .alert-warning</h3>
    <ux-code-block code="<div class=&quot;alert-info show&quot;>Info alert message</div>&#10;<div class=&quot;alert-danger show&quot;>Danger alert</div>&#10;<div class=&quot;alert-warning show&quot;>Warning alert</div>">
      <div style="width: 100%; display: flex; flex-direction: column; gap: 8px">
        <div class="alert-info show">Info: Something informational happened.</div>
        <div class="alert-danger show">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <div class="alert-body">Danger: Something went wrong.</div>
        </div>
      </div>
    </ux-code-block>
  </section>
</template>

<script setup lang="ts">
import UxCodeBlock from './UxCodeBlock.vue'
</script>
