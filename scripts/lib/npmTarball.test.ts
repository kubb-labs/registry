import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { isDocsFile } from './docs.ts'
import { tar } from './fixtures.ts'
import { matchesIntegrity, readTarFiles } from './npmTarball.ts'

describe('readTarFiles', () => {
  it('reads the wanted regular files, and the first copy of a path wins', () => {
    const archive = tar([
      ['package/package.json', '{}'],
      ['package/kubb-extension.json', '{"kind":"plugin"}'],
      ['package/OVERVIEW.md', '/etc/passwd', '2'],
      ['package/OVERVIEW.md', '# Overview'],
      ['package/OVERVIEW.md', '# Second copy'],
    ])

    expect(readTarFiles({ tar: archive, wanted: (path) => path === 'kubb-extension.json' || path === 'OVERVIEW.md' })).toStrictEqual({
      files: new Map([
        ['kubb-extension.json', '{"kind":"plugin"}'],
        ['OVERVIEW.md', '# Overview'],
      ]),
      tooLarge: [],
    })
  })

  it('passes paths relative to the package root, so docs files are kept and deeper or non-Markdown ones are not', () => {
    const archive = tar([
      ['package/docs/overview.md', '# Overview'],
      ['package/docs/guides/authentication.md', '# Authentication'],
      ['package/docs/guides/advanced/retries.md', '# Retries'],
      ['package/docs/guides/diagram.png', 'png'],
      ['package/docs/notes.txt', 'notes'],
      ['package/docs', '', '5'],
      ['package/src/docs/options.md', '# Options'],
    ])

    expect(readTarFiles({ tar: archive, wanted: isDocsFile }).files).toStrictEqual(
      new Map([
        ['docs/overview.md', '# Overview'],
        ['docs/guides/authentication.md', '# Authentication'],
      ]),
    )
  })

  it('lists a wanted file larger than 256 KiB instead of reading it', () => {
    const archive = tar([
      ['package/docs/guides/huge.md', 'x'.repeat(256 * 1024 + 1)],
      ['package/docs/guides/huge.md', '# Small copy'],
      ['package/docs/options.md', '# Options'],
    ])

    expect(readTarFiles({ tar: archive, wanted: isDocsFile })).toStrictEqual({
      files: new Map([['docs/options.md', '# Options']]),
      tooLarge: ['docs/guides/huge.md'],
    })
  })
})

describe('matchesIntegrity', () => {
  it('compares the SHA-512 of the bytes', () => {
    const bytes = new TextEncoder().encode('tarball')
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`

    expect(matchesIntegrity({ bytes, integrity })).toBe(true)
    expect(matchesIntegrity({ bytes: new TextEncoder().encode('tampered'), integrity })).toBe(false)
    expect(matchesIntegrity({ bytes, integrity: 'sha1-abc' })).toBe(false)
  })
})
