<template>
  <header class="header">
    <header-actions :logged-in="false" />
  </header>
  <h1>PlainApp</h1>
  <div class="login-block">
    <form v-show="!showConfirm" @submit.prevent="onSubmit">
      <div v-show="showError" class="alert alert-danger show" role="alert">
        <i-material-symbols:error-outline-rounded />
        <div class="body">
          {{ error ? $t(error) : '' }}
        </div>
      </div>
      <v-text-field
        v-if="showPasswordInput"
        v-model="password"
        :label="t('password')"
        type="password"
        class="form-control"
        :error="!!passwordError"
        autocomplete="current-password"
        :error-text="passwordError ? $t(passwordError) : ''"
        @keydown.enter="onSubmit"
      />
      <v-filled-button v-if="!webAccessDisabled" :disabled="isSubmitting" :loading="isSubmitting">
        {{ $t(isSubmitting ? 'logging_in' : 'log_in') }}
      </v-filled-button>
    </form>
    <div v-show="showConfirm">
      <div class="tap-phone">
        <TouchPhone />
      </div>
      <div class="tap-phone-text">
        {{ $t('login.to_continue') }}
      </div>
      <v-outlined-button @click="cancel">
        {{ $t('cancel') }}
      </v-outlined-button>
    </div>
  </div>
  <div v-if="showWarning" class="tips">{{ $t('browser_warning') }}</div>
</template>
<script setup lang="ts">
import { useLogin } from './login'

const showWarning = window.location.protocol === 'http:' ? false : !(window.navigator as any).userAgentData

const {
  showError, webAccessDisabled, showConfirm, error, showPasswordInput,
  password, passwordError, isSubmitting, onSubmit, cancel, t,
} = useLogin()
</script>

<style lang="scss" scoped>
.header {
  display: flex;
  justify-content: end;
  margin-top: 6px;
}

.v-filled-button,
.v-outlined-button {
  margin-top: 24px;
  width: 100%;
}

h1 {
  margin-top: 100px;
  text-align: center;
}

.login-block {
  width: 280px;
  margin: 0 auto;
  --outlined-field-bg: var(--md-sys-color-surface-variant);
  background-color: var(--md-sys-color-surface-variant);
  border-radius: var(--pl-shape-xl);
  padding-block: var(--pl-spacing-xl);
  padding: 40px;

  .tap-phone {
    text-align: center;
    padding-block-end: 1rem;

    *:is(svg) {
      width: 120px;
      height: auto;
      fill: var(--md-sys-color-primary);
    }
  }
  .tap-phone-text {
    text-align: center;
  }
}

.tips {
  text-align: center;
  padding: 16px;
  width: 320px;
  margin: 0 auto;
}

.alert-danger {
  margin-block-end: 16px;
}
</style>
