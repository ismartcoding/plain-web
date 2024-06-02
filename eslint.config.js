import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

// https://github.com/vuejs/eslint-config-prettier/issues/19
// too complicated to fix this issue, ignore it for now
export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  prettier,
  {
    // extends: ['plugin:vue/vue3-essential', 'eslint:recommended', '@vue/eslint-config-typescript/recommended', '@vue/eslint-config-prettier'],
    // files: ['**/*.vue', '**/*.js', '**/*.ts', '**/*.tsx'],
    files: ['**/*.{js,vue,ts,tsx}'],
    ignores: ['**/.gitignore'],
    rules: {
      'vue/no-deprecated-slot-attribute': 'off',
    },
  },
]
