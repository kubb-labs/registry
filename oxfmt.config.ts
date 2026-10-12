import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 160,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'all',
  semi: false,
  singleQuote: true,
  endOfLine: 'lf',
  ignorePatterns: ['dist/**', 'node_modules/**', 'pnpm-lock.yaml'],
})
