import { describe, expect, it } from 'vitest'
import {
  applyListing,
  approveRecord,
  bumpRecord,
  compareVersions,
  recordDateProblems,
  recordIdFromPath,
  registryTypeOf,
  validateManifest,
  validateRecord,
} from './records.ts'
import type { RegistryRecord } from './types.ts'

const known = new Set(['validation', 'types'])

const record: RegistryRecord = {
  id: 'kubb-labs/plugin-zod',
  artifact: { kind: 'npm', package: '@kubb/plugin-zod', version: '5.4.4' },
  repository: { url: 'https://github.com/kubb-labs/plugins/tree/main/packages/plugin-zod' },
  submittedAt: '2026-10-12T20:00:00Z',
  submittedBy: 'stijnvanhulle',
  publishedAt: '2026-10-12T20:00:00Z',
  reviewedAt: '2026-10-12T20:00:00Z',
  categories: ['validation'],
}

describe('validateRecord', () => {
  it('accepts a record whose id matches its path, package, and repository owner', () => {
    expect(validateRecord({ record, relativePath: 'kubb-labs/plugin-zod.json', knownCategories: known })).toStrictEqual([])
  })

  it('rejects an id that differs from the path', () => {
    expect(validateRecord({ record, relativePath: 'kubb-labs/plugin-ts.json', knownCategories: known })).toStrictEqual([
      '/id "kubb-labs/plugin-zod" must equal the path "kubb-labs/plugin-ts"',
    ])
  })

  it('rejects a slug that is not the package name without its scope', () => {
    const other = { ...record, id: 'kubb-labs/zod' }
    expect(validateRecord({ record: other, relativePath: 'kubb-labs/zod.json', knownCategories: known })).toStrictEqual([
      '/id slug "zod" must equal the package name without its scope "plugin-zod"',
    ])
  })

  it('rejects an owner that is not the repository owner', () => {
    const other = { ...record, id: 'someone/plugin-zod' }
    expect(validateRecord({ record: other, relativePath: 'someone/plugin-zod.json', knownCategories: known })).toStrictEqual([
      '/id owner "someone" must equal the repository owner "kubb-labs"',
    ])
  })

  it('rejects a category that is not in categories.json', () => {
    expect(
      validateRecord({ record: { ...record, categories: ['validation', 'graphql'] }, relativePath: 'kubb-labs/plugin-zod.json', knownCategories: known }),
    ).toStrictEqual(['/categories "graphql" is not in categories.json'])
  })

  it.each([
    ['a missing field', { ...record, reviewedAt: undefined }],
    ['a timestamp with milliseconds', { ...record, reviewedAt: '2026-10-12T20:00:00.000Z' }],
    ['a version range', { ...record, artifact: { ...record.artifact, version: '^5.4.4' } }],
    ['an unknown key', { ...record, extra: true }],
    ['a repository outside GitHub', { ...record, repository: { url: 'https://gitlab.com/kubb-labs/plugins' } }],
    ['empty categories', { ...record, categories: [] }],
  ])('rejects %s', (_label, invalid) => {
    expect(validateRecord({ record: invalid, relativePath: 'kubb-labs/plugin-zod.json', knownCategories: known }).length).toBeGreaterThan(0)
  })
})

describe('validateManifest', () => {
  const manifest = { kind: 'plugin', name: 'plugin-zod', export: 'pluginZod', displayName: 'Zod', description: 'Generates Zod schemas.' }

  it('accepts a manifest with the required fields', () => {
    expect(validateManifest(manifest)).toStrictEqual([])
  })

  it('rejects an unknown compatibility key', () => {
    expect(validateManifest({ ...manifest, compatibility: { kubb: '>=5', nodejs: '>=22' } })).toStrictEqual([
      '/compatibility must NOT have additional properties',
    ])
  })

  it('rejects a manifest without an export', () => {
    const { export: _export, ...rest } = manifest
    expect(validateManifest(rest)).toStrictEqual(["/ must have required property 'export'"])
  })

  it('ignores unknown top-level keys', () => {
    expect(validateManifest({ ...manifest, future: 1 })).toStrictEqual([])
  })
})

describe('helpers', () => {
  it('reads the record id from its path', () => {
    expect(recordIdFromPath('kubb-labs/plugin-zod.json')).toBe('kubb-labs/plugin-zod')
    expect(recordIdFromPath('Kubb_Labs/plugin-zod.json')).toBeNull()
  })

  it('derives the type from the owner', () => {
    expect(registryTypeOf('kubb-labs/plugin-zod')).toBe('official')
    expect(registryTypeOf('acme/kubb-plugin-x')).toBe('community')
  })

  it('applies listing overrides and the main category over the manifest', () => {
    const manifest = { kind: 'plugin' as const, name: 'x', export: 'x', displayName: 'X', description: 'Old.', category: 'types' }
    expect(applyListing({ manifest, record: { listing: { description: 'New.' }, categories: ['validation', 'types'] } })).toStrictEqual({
      ...manifest,
      description: 'New.',
      category: 'validation',
    })
    expect(applyListing({ manifest, record: {} })).toStrictEqual(manifest)
  })
})

describe('recordDateProblems', () => {
  it('accepts a new record stamped to the second', () => {
    expect(recordDateProblems({ record, listed: undefined })).toStrictEqual([])
  })

  it('rejects a new date without the time', () => {
    expect(recordDateProblems({ record: { ...record, reviewedAt: '2026-10-12' }, listed: undefined })).toStrictEqual([
      expect.stringMatching(/^reviewedAt must be a UTC timestamp to the second/),
    ])
  })

  it('accepts a bump that moves only reviewedAt', () => {
    expect(recordDateProblems({ record: { ...record, reviewedAt: '2026-10-19T06:17:00Z' }, listed: record })).toStrictEqual([])
  })

  it('rejects an update that changes submittedAt or publishedAt', () => {
    expect(
      recordDateProblems({ record: { ...record, submittedAt: '2026-10-19T06:17:00Z', publishedAt: '2026-10-19T06:17:00Z' }, listed: record }),
    ).toStrictEqual([
      'submittedAt must stay "2026-10-12T20:00:00Z"; an update moves reviewedAt only',
      'publishedAt must stay "2026-10-12T20:00:00Z"; an update moves reviewedAt only',
    ])
  })

  it('rejects moving reviewedAt back', () => {
    expect(recordDateProblems({ record: { ...record, reviewedAt: '2026-10-01T00:00:00Z' }, listed: record })).toStrictEqual(['reviewedAt must not move back'])
  })
})

describe('bump decision', () => {
  it.each([
    ['5.4.5', '5.4.4', 1],
    ['5.10.0', '5.9.9', 1],
    ['5.4.4', '5.4.4', 0],
    ['5.4.4-beta.1', '5.4.4', -1],
    ['5.4.4-beta.10', '5.4.4-beta.2', 1],
    ['5.4.4-alpha', '5.4.4-beta', -1],
  ])('compares %s with %s', (a, b, expected) => {
    expect(compareVersions({ a, b })).toBe(expected)
  })

  it('moves the pin and reviewedAt when latest is newer', () => {
    expect(bumpRecord({ record, latest: '5.5.0', now: new Date('2026-10-19T08:00:00.123Z') })).toStrictEqual({
      ...record,
      artifact: { ...record.artifact, version: '5.5.0' },
      reviewedAt: '2026-10-19T08:00:00Z',
    })
  })

  it.each(['5.4.4', '5.4.3'])('keeps the record when latest is %s', (latest) => {
    expect(bumpRecord({ record, latest, now: new Date() })).toBeNull()
  })
})

describe('approveRecord', () => {
  const now = new Date('2026-10-14T09:30:00.500Z')

  it('stamps publishedAt and reviewedAt on a new record', () => {
    expect(approveRecord({ record, listed: false, now })).toStrictEqual({ ...record, publishedAt: '2026-10-14T09:30:00Z', reviewedAt: '2026-10-14T09:30:00Z' })
  })

  it('keeps publishedAt on a listed record and moves reviewedAt only', () => {
    expect(approveRecord({ record, listed: true, now })).toStrictEqual({ ...record, reviewedAt: '2026-10-14T09:30:00Z' })
  })
})
