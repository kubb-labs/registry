import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRegistry } from './build.ts'
import { tar } from './fixtures.ts'
import type { LoadedRecord } from './load.ts'
import type { RegistryRecord } from './types.ts'

const dates = { submittedAt: '2026-10-12T20:00:00Z', submittedBy: 'acme', publishedAt: '2026-10-12T20:00:00Z', reviewedAt: '2026-10-12T20:00:00Z' }

const community: RegistryRecord = {
  id: 'acme/kubb-plugin-x',
  artifact: { kind: 'npm', package: '@acme/kubb-plugin-x', version: '1.2.0' },
  repository: { url: 'https://github.com/acme/kubb-plugins/tree/main/packages/x' },
  categories: ['validation'],
  listing: { description: 'Generates X from the reviewer.' },
  ...dates,
}

const official: RegistryRecord = {
  id: 'kubb-labs/plugin-old',
  artifact: { kind: 'npm', package: '@kubb/plugin-old', version: '5.0.0' },
  repository: { url: 'https://github.com/kubb-labs/plugins/tree/main/packages/plugin-old' },
  ...dates,
}

const withDocs: RegistryRecord = {
  id: 'acme/kubb-plugin-y',
  artifact: { kind: 'npm', package: '@acme/kubb-plugin-y', version: '2.0.0' },
  repository: { url: 'https://github.com/acme/kubb-plugins/tree/main/packages/y' },
  ...dates,
}

const manifest = { kind: 'plugin', name: 'plugin-x', export: 'pluginX', displayName: 'X', description: 'Generates X.', category: 'types' }
const manifestY = { kind: 'plugin', name: 'plugin-y', export: 'pluginY', displayName: 'Y', description: 'Generates Y.', category: 'types' }
const docs = {
  overview: '# Y\n\nGenerates Y.\n',
  options: '# Options\n\nPass these options to `pluginY()`.\n',
  authentication: '# Authentication\n\nSend a token with every request.\n',
}

/** The routes npm answers for one version: its packument and its gzipped tarball. */
function publish({ pkg, version, files }: { pkg: string; version: string; files: Array<[string, string]> }): Array<[string, unknown]> {
  const tarball = gzipSync(tar(files.map(([name, content]) => [`package/${name}`, content])))
  const url = `https://registry.npmjs.org/${pkg}/-/${version}.tgz`
  const integrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`
  return [
    [`https://registry.npmjs.org/${pkg}`, { versions: { [version]: { dist: { tarball: url, integrity } } } }],
    [url, tarball],
  ]
}

const routes = new Map<string, unknown>([
  ...publish({
    pkg: '@acme/kubb-plugin-x',
    version: '1.2.0',
    files: [
      ['kubb-extension.json', JSON.stringify(manifest)],
      ['OVERVIEW.md', 'Generates X.\n'],
    ],
  }),
  ...publish({
    pkg: '@acme/kubb-plugin-y',
    version: '2.0.0',
    files: [
      ['kubb-extension.json', JSON.stringify(manifestY)],
      ['OVERVIEW.md', 'An older overview.\n'],
      ['docs/overview.md', docs.overview],
      ['docs/options.md', docs.options],
      ['docs/guides/retries.md', 'Retries without a title.\n'],
      ['docs/guides/authentication.md', docs.authentication],
      ['docs/guides/advanced/deep.md', '# Deep\n\nNot read.\n'],
    ],
  }),
  ...publish({ pkg: '@kubb/plugin-old', version: '5.0.0', files: [['package.json', '{}']] }),
  ['https://api.npmjs.org/downloads/point/last-month/@acme/kubb-plugin-x', { downloads: 100 }],
  ['https://api.npmjs.org/downloads/point/last-week/@acme/kubb-plugin-x', { downloads: 25 }],
  ['https://api.npmjs.org/downloads/point/last-month/@acme/kubb-plugin-y', { downloads: 40 }],
  ['https://api.npmjs.org/downloads/point/last-week/@acme/kubb-plugin-y', { downloads: 10 }],
  ['https://api.github.com/repos/acme/kubb-plugins', { stargazers_count: 7 }],
])

function stubNpm(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = routes.get(url)
      if (body === undefined) return new Response(null, { status: 404 })
      return body instanceof Uint8Array ? new Response(body) : Response.json(body)
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('buildRegistry', () => {
  it('lists records from their pinned tarballs, reads a root OVERVIEW.md, and leaves out versions without a manifest', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubNpm()
    const records: Array<LoadedRecord> = [
      { record: official, path: 'kubb-labs/plugin-old.json', registryOverview: 'Old plugin.\n' },
      { record: community, path: 'acme/kubb-plugin-x.json', registryOverview: null },
    ]

    const { index, details } = await buildRegistry(records)

    expect(index.version).toBe(1)
    expect(index.extensions).toStrictEqual([
      {
        id: 'acme/kubb-plugin-x',
        kind: 'plugin',
        type: 'community',
        artifact: community.artifact,
        repository: community.repository,
        manifest: { ...manifest, category: 'validation', description: 'Generates X from the reviewer.' },
        stats: { downloads: 100, weekly: 25, stars: 7 },
        submittedAt: dates.submittedAt,
        publishedAt: dates.publishedAt,
        reviewedAt: dates.reviewedAt,
      },
    ])
    expect(details).toStrictEqual([{ ...index.extensions[0], overview: 'Generates X.\n', options: null, guides: [] }])
    expect(warnings.mock.calls.flat().join('\n')).toContain('kubb-labs/plugin-old: @kubb/plugin-old@5.0.0 ships no valid kubb-extension.json')
  })

  it('publishes the docs folder in the detail, leaves it out of the index, and keeps the extension when a guide fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubNpm()

    const { index, details } = await buildRegistry([{ record: withDocs, path: 'acme/kubb-plugin-y.json', registryOverview: 'Registry copy.\n' }])

    expect(index.extensions).toStrictEqual([
      {
        id: 'acme/kubb-plugin-y',
        kind: 'plugin',
        type: 'community',
        artifact: withDocs.artifact,
        repository: withDocs.repository,
        manifest: manifestY,
        stats: { downloads: 40, weekly: 10, stars: 7 },
        submittedAt: dates.submittedAt,
        publishedAt: dates.publishedAt,
        reviewedAt: dates.reviewedAt,
      },
    ])
    expect(details).toStrictEqual([
      {
        ...index.extensions[0],
        overview: docs.overview,
        options: docs.options,
        guides: [{ id: 'authentication', title: 'Authentication', description: 'Send a token with every request.', content: docs.authentication }],
      },
    ])
    expect(warnings.mock.calls.flat().join('\n')).toContain(
      'acme/kubb-plugin-y: docs/guides/retries.md of @acme/kubb-plugin-y@2.0.0: the first line is not a "# Title" heading',
    )
  })
})
