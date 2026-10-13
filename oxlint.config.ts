import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['typescript'],
  ignorePatterns: ['dist/**', 'node_modules/**'],
  rules: {
    'typescript/consistent-type-imports': 'error',
  },
})
