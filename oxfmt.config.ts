import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 160,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'all',
  semi: false,
  singleQuote: true,
  endOfLine: 'lf',
  // Records are written by the submit, bump, and approve scripts with JSON.stringify, so they keep that layout.
  ignorePatterns: ['dist/**', 'node_modules/**', 'pnpm-lock.yaml', 'extensions/**/*.json'],
})
