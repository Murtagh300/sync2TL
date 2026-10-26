// ESLint for the wallet: TypeScript and Vue, with rules that catch bugs rather than argue style.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default tseslint.config(
    {
        ignores: ['dist/**', '.quasar/**', 'node_modules/**', 'src-pwa/node_modules/**', 'public/**', 'quasar.config.ts.temporary.compiled.*', 'test-results/**', 'playwright-report/**']
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...pluginVue.configs['flat/essential'],
    {
        files: ['**/*.{ts,vue,js,cjs,mjs}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.node, Connex: 'readonly', M: 'readonly', __statics: 'readonly' },
            parserOptions: {
                parser: tseslint.parser,
                extraFileExtensions: ['.vue']
            }
        },
        rules: {
            // `ready && go()` is the house style for a guarded call
            '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
            // dialogs keep what was typed in a state object their caller owns (and passes again)
            'vue/no-mutating-props': ['error', { shallowOnly: true }],
            // the code base uses namespaces for types (M, Connex, BVM)
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
            // an empty catch is how "ignore and go on" is written here
            'no-empty': ['error', { allowEmptyCatch: true }],
            '@typescript-eslint/no-empty-function': 'off',
            'vue/multi-word-component-names': 'off',
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            // a wallet never builds HTML from strings
            'vue/no-v-html': 'error',
            'vue/no-v-text-v-html-on-component': 'error'
        }
    },
    {
        // typings of Cordova plugins, as their authors wrote them
        files: ['src/shims-*.d.ts'],
        rules: { '@typescript-eslint/no-explicit-any': 'off' }
    },
    {
        files: ['**/*.cjs'],
        languageOptions: { sourceType: 'commonjs' },
        rules: { '@typescript-eslint/no-require-imports': 'off' }
    },
    {
        files: ['test/**', 'e2e/**'],
        rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-non-null-assertion': 'off' }
    }
)
