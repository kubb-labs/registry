import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { tar } from './fixtures.ts'
import { matchesIntegrity, readTarFiles } from './npmTarball.ts'

describe('readTarFiles', () => {
  it('reads wanted regular files at the package root only', () => {
    const archive = tar([
      ['package/package.json', '{}'],
      ['package/kubb-extension.json', '{"kind":"plugin"}'],
      ['package/docs/OVERVIEW.md', 'nested'],
      ['package/OVERVIEW.md', '/etc/passwd', '2'],
      ['package/OVERVIEW.md', '# Overview'],
    ])

    expect(readTarFiles({ tar: archive, wanted: new Set(['kubb-extension.json', 'OVERVIEW.md']) })).toStrictEqual(
      new Map([
        ['kubb-extension.json', '{"kind":"plugin"}'],
        ['OVERVIEW.md', '# Overview'],
      ]),
    )
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
