import { describe, expect, it } from 'vitest'
import { applyListing, approveRecord, bumpRecord, recordDateProblems, registryTypeOf, validateManifest, validateRecord } from './records.ts'
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

const commit = '0123456789abcdef0123456789abcdef01234567'

const githubRecord: RegistryRecord = {
  ...record,
  id: 'acme/kubb-plugin-x',
  artifact: { kind: 'github', package: '@acme/kubb-plugin-x', version: '1.2.0', owner: 'acme', repo: 'kubb-plugin-x', tag: 'v1.2.0', commit },
  repository: { url: 'https://github.com/acme/kubb-plugin-x' },
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

  it('rejects an owner kubb.dev reserves for its filter pages', () => {
    const other = { ...record, id: 'category/plugin-zod', repository: { url: 'https://github.com/category/plugin-zod' } }
    expect(validateRecord({ record: other, relativePath: 'category/plugin-zod.json', knownCategories: known })).toStrictEqual([
      '/id owner "category" is reserved for kubb.dev\'s /extensions/category/ pages',
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

describe('validateRecord for a GitHub release', () => {
  const validate = (overrides: Partial<RegistryRecord>, artifact?: object) =>
    validateRecord({
      record: { ...githubRecord, ...overrides, artifact: { ...githubRecord.artifact, ...artifact } },
      relativePath: 'acme/kubb-plugin-x.json',
      knownCategories: known,
    })

  it('accepts a release pinned to its commit at the repository root', () => {
    expect(validate({})).toStrictEqual([])
  })

  it('rejects a repository URL that points at a folder', () => {
    expect(validate({ repository: { url: 'https://github.com/acme/kubb-plugin-x/tree/main/packages/x' } })).toStrictEqual([
      '/repository/url must be "https://github.com/acme/kubb-plugin-x", the repository root the GitHub artifact installs from',
    ])
  })

  it('rejects a tag that names another version', () => {
    expect(validate({}, { tag: 'v1.3.0' })).toStrictEqual(['/artifact/tag "v1.3.0" must be "v1.2.0" or "1.2.0"'])
  })

  it('rejects a scope that is not the repository owner', () => {
    expect(
      validate({ id: 'acme/plugin-x' } as Partial<RegistryRecord>, { package: '@kubb/plugin-x' }).filter((error) => error.startsWith('/artifact')),
    ).toStrictEqual(['/artifact/package scope "@kubb" must be the repository owner "@acme"'])
  })

  it.each([
    ['a short commit', { commit: '0123456' }],
    ['an upper-case owner', { owner: 'Acme' }],
    ['a tag that is no version', { tag: 'latest' }],
    ['a missing commit', { commit: undefined }],
  ])('rejects %s', (_label, artifact) => {
    expect(validate({}, artifact).length).toBeGreaterThan(0)
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

  it.each([
    ['an unknown kind', { ...manifest, kind: 'loader' }],
    ['an empty name', { ...manifest, name: '' }],
    ['an export that is not an identifier', { ...manifest, export: 'plugin-zod' }],
    ['a select without choices', { ...manifest, options: [{ key: 'mode', path: ['mode'], label: 'Mode', type: 'select', choices: [] }] }],
  ])('rejects %s', (_label, invalid) => {
    expect(validateManifest(invalid).length).toBeGreaterThan(0)
  })

  it('runs the semantic checks after the schema', () => {
    const option = { key: 'mode', path: ['mode'], label: 'Mode', type: 'text' }
    expect(validateManifest({ ...manifest, options: [option, option] })).toStrictEqual(['option "mode" is declared more than once'])
  })
})

describe('helpers', () => {
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
  it('accepts a new record', () => {
    expect(recordDateProblems({ record, listed: undefined })).toStrictEqual([])
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

describe('bumpRecord', () => {
  it('moves the pin and reviewedAt when latest is newer', () => {
    expect(bumpRecord({ record, latest: '5.5.0', now: new Date('2026-10-19T08:00:00.123Z') })).toStrictEqual({
      ...record,
      artifact: { ...record.artifact, version: '5.5.0' },
      reviewedAt: '2026-10-19T08:00:00Z',
    })
  })

  it('moves a GitHub record to the release tag and its commit', () => {
    const next = 'fedcba9876543210fedcba9876543210fedcba98'
    expect(bumpRecord({ record: githubRecord, latest: '1.3.0', pin: { tag: 'v1.3.0', commit: next }, now: new Date('2026-10-19T08:00:00Z') })).toStrictEqual({
      ...githubRecord,
      artifact: { ...githubRecord.artifact, version: '1.3.0', tag: 'v1.3.0', commit: next },
      reviewedAt: '2026-10-19T08:00:00Z',
    })
  })

  it.each([
    ['5.4.5', '5.4.4', true],
    ['5.10.0', '5.9.9', true],
    ['5.4.4', '5.4.4', false],
    ['5.4.3', '5.4.4', false],
    ['5.4.4', '5.4.4-beta.1', true],
    ['5.4.4-beta.1', '5.4.4', false],
    ['5.4.4-beta.10', '5.4.4-beta.2', true],
    ['5.4.4-beta', '5.4.4-beta.1', false],
    ['5.4.4-beta', '5.4.4-alpha', true],
    ['5.4.4-beta', '5.4.4-1', true],
  ])('latest %s over pin %s bumps: %s', (latest, version, bumps) => {
    expect(bumpRecord({ record: { ...record, artifact: { ...record.artifact, version } }, latest, now: new Date() }) !== null).toBe(bumps)
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
