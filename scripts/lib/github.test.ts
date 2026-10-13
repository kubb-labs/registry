import { afterEach, describe, expect, it, vi } from 'vitest'
import { githubArchive } from './fixtures.ts'
import { fetchGitHubFiles, fetchLatestRelease, resolveTagCommit, versionOfTag } from './github.ts'

const commit = '0123456789abcdef0123456789abcdef01234567'
const tagObject = 'fedcba9876543210fedcba9876543210fedcba98'
const repo = { owner: 'acme', repo: 'kubb-plugin-x', scope: 'test' }
const api = 'https://api.github.com/repos/acme/kubb-plugin-x'

function stubFetch(routes: Map<string, unknown>): void {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
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

describe('versionOfTag', () => {
  it.each([
    ['v1.2.0', '1.2.0'],
    ['1.2.0', '1.2.0'],
    ['v2.0.0-beta.1', '2.0.0-beta.1'],
    ['release-1.2.0', null],
    ['v1.2', null],
    [undefined, null],
  ])('reads %s as %s', (tag, version) => {
    expect(versionOfTag(tag)).toBe(version)
  })
})

describe('resolveTagCommit', () => {
  it('reads the commit of a lightweight tag', async () => {
    stubFetch(new Map([[`${api}/git/ref/tags/v1.2.0`, { object: { type: 'commit', sha: commit } }]]))

    expect(await resolveTagCommit({ ...repo, tag: 'v1.2.0' })).toBe(commit)
  })

  it('follows an annotated tag to its commit', async () => {
    stubFetch(
      new Map([
        [`${api}/git/ref/tags/v1.2.0`, { object: { type: 'tag', sha: tagObject } }],
        [`${api}/git/tags/${tagObject}`, { object: { type: 'commit', sha: commit } }],
      ]),
    )

    expect(await resolveTagCommit({ ...repo, tag: 'v1.2.0' })).toBe(commit)
  })

  it('gives null for a tag the repository does not have', async () => {
    stubFetch(new Map())

    expect(await resolveTagCommit({ ...repo, tag: 'v1.2.0' })).toBeNull()
  })
})

describe('fetchLatestRelease', () => {
  it('reads the tag and its version', async () => {
    stubFetch(new Map([[`${api}/releases/latest`, { tag_name: 'v1.2.0' }]]))

    expect(await fetchLatestRelease(repo)).toStrictEqual({ tag: 'v1.2.0', version: '1.2.0' })
  })

  it.each([
    ['a tag that names no semver version', new Map([[`${api}/releases/latest`, { tag_name: 'nightly' }]])],
    ['no release', new Map()],
  ])('gives null for %s', async (_label, routes) => {
    stubFetch(routes)

    expect(await fetchLatestRelease(repo)).toBeNull()
  })
})

describe('fetchGitHubFiles', () => {
  it('reads the archive of the commit by path relative to the repository root', async () => {
    const archive = githubArchive({
      repo: 'kubb-plugin-x',
      commit,
      files: [
        ['package.json', '{"name":"@acme/kubb-plugin-x"}'],
        ['dist/index.js', 'export {}'],
        ['docs/overview.md', '# X'],
      ],
    })
    stubFetch(new Map([[`https://codeload.github.com/acme/kubb-plugin-x/tar.gz/${commit}`, archive]]))

    const read = await fetchGitHubFiles({ ...repo, commit, wanted: (path) => path.endsWith('.md') || path === 'package.json' })

    expect(read).toStrictEqual({
      status: 'ok',
      files: new Map([
        ['package.json', '{"name":"@acme/kubb-plugin-x"}'],
        ['docs/overview.md', '# X'],
      ]),
      tooLarge: [],
      paths: new Set(['package.json', 'dist/index.js', 'docs/overview.md']),
    })
  })

  it('reports an archive that cannot be read', async () => {
    stubFetch(new Map())

    expect(await fetchGitHubFiles({ ...repo, commit, wanted: () => true })).toStrictEqual({
      status: 'error',
      message: `acme/kubb-plugin-x@${commit}: https://codeload.github.com/acme/kubb-plugin-x/tar.gz/${commit} answered 404`,
    })
  })
})
