/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  extends: ['plugin:vue/vue3-essential', 'eslint:recommended', '@vue/eslint-config-typescript/recommended', '@vue/eslint-config-prettier'],
  env: {
    'vue/setup-compiler-macros': true,
  },
  rules: {
    'vue/no-deprecated-slot-attribute': 'off',
    'no-control-regex': 'off', // Fix Unexpected control character(s) in regular expression: \x08  no-control-regex
  },
}
