import { describe, expect, it } from 'vitest'
import { readChanges, toPlainText } from './changelog.ts'

const changelog = `# @kubb/plugin-zod

## 6.0.0

### Major Changes

- [#1200](https://github.com/kubb-labs/plugins/pull/1200) [\`abc1234\`](https://github.com/kubb-labs/plugins/commit/abc1234) Thanks [@stijnvanhulle](https://github.com/stijnvanhulle)! - Support **Zod 4** only. See the [migration guide](https://kubb.dev/migrate/zod-6) for the steps.

  - Drops \`zod@3\`.

### Patch Changes

- Updated dependencies [[\`abc1234\`](https://github.com/kubb-labs/plugins/commit/abc1234)]:
  - @kubb/plugin-ts@6.0.0

## 5.4.12

### Patch Changes

- Updated dependencies [[\`def5678\`](https://github.com/kubb-labs/plugins/commit/def5678)]:
  - @kubb/plugin-ts@5.4.12
- [#1139](https://github.com/kubb-labs/plugins/pull/1139) [\`cd003f2\`](https://github.com/kubb-labs/plugins/commit/cd003f2) Thanks [@stijnvanhulle](https://github.com/stijnvanhulle)! - Require Node.js 22.12 or higher.
`

describe('readChanges', () => {
  it('reads the first entry of a major version as plain text, with the guide it links to', () => {
    expect(readChanges({ changelog, version: '6.0.0' })).toStrictEqual({
      summary: 'Support Zod 4 only',
      breaking: true,
      guide: 'https://kubb.dev/migrate/zod-6',
    })
  })

  it('skips dependency bumps and leaves out breaking and guide when the section has neither', () => {
    expect(readChanges({ changelog, version: '5.4.12' })).toStrictEqual({ summary: 'Require Node.js 22.12 or higher' })
  })

  it('returns null for a version without a section', () => {
    expect(readChanges({ changelog, version: '5.4.11' })).toBeNull()
  })

  it('finds a heading that links the version', () => {
    expect(
      readChanges({ changelog: '## [1.2.0](https://github.com/acme/x/compare/v1.1.0...v1.2.0) (2026-10-01)\n\n* add retries (#12)\n', version: '1.2.0' }),
    ).toStrictEqual({
      summary: 'add retries',
    })
  })
})

describe('toPlainText', () => {
  it('drops links, PR refs, code marks, emphasis, HTML, and control characters', () => {
    expect(toPlainText('Use `pluginTs()` with _strict_ <b>types</b> ([#12](https://x.test/12)) from [docs](https://kubb.dev)\u001B[31m')).toBe(
      'Use pluginTs() with strict types from docs',
    )
  })
})
