/**
 * Reads a GitHub release without installing or running it: the tag is resolved in the repository
 * itself, and files come from the archive GitHub serves for the commit, read in memory. It is the
 * archive npm and pnpm download for a `github:<owner>/<repo>#<commit>` dependency.
 */
import { gunzipSync } from 'node:zlib'
import { fetchBytes, fetchJson } from './http.ts'
import { MAX_TARBALL_BYTES, readTarFiles, type TarFiles } from './npmTarball.ts'

const API = 'https://api.github.com'
const COMMIT = /^[0-9a-f]{40}$/
const RELEASE_TAG = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/

/** REST API headers. `GITHUB_TOKEN` raises the limit from 60 requests an hour. */
export const githubHeaders = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'kubb-labs-registry',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
}

type Repository = { owner: string; repo: string }
type GitObject = { object?: { type?: string; sha?: string } }

/**
 * A release tag and the version it names: `v1.2.0` and `1.2.0` both name `1.2.0`. Null for any other tag.
 */
export function releaseOfTag(tag: unknown): { tag: string; version: string } | null {
  if (typeof tag !== 'string') return null
  const version = tag.match(RELEASE_TAG)?.[1]
  return version ? { tag, version } : null
}

/**
 * The commit `tag` points to, following an annotated tag, or null when the repository has no such
 * tag. Refs list only the repository's own tags, so a commit that exists only in a fork never matches.
 */
export async function resolveTagCommit({ owner, repo, tag, scope }: Repository & { tag: string; scope: string }): Promise<string | null> {
  let ref = await fetchJson<GitObject>({ url: `${API}/repos/${owner}/${repo}/git/ref/tags/${encodeURIComponent(tag)}`, headers: githubHeaders, scope })
  for (let hop = 0; ref?.object?.type === 'tag' && COMMIT.test(ref.object.sha ?? '') && hop < 2; hop++) {
    ref = await fetchJson<GitObject>({ url: `${API}/repos/${owner}/${repo}/git/tags/${ref.object.sha}`, headers: githubHeaders, scope })
  }
  const sha = ref?.object?.type === 'commit' ? ref.object.sha : undefined
  return sha && COMMIT.test(sha) ? sha : null
}

/**
 * The latest release, which is never a draft or a prerelease, or null when there is none or its tag
 * names no semver version.
 */
export async function fetchLatestRelease({ owner, repo, scope }: Repository & { scope: string }): Promise<{ tag: string; version: string } | null> {
  const release = await fetchJson<{ tag_name?: unknown }>({ url: `${API}/repos/${owner}/${repo}/releases/latest`, headers: githubHeaders, scope })
  return releaseOfTag(release?.tag_name)
}

/**
 * The files at `commit` that `wanted` accepts, by path relative to the repository root, or an error
 * when the archive cannot be read.
 */
export async function fetchGitHubFiles({
  owner,
  repo,
  commit,
  wanted,
}: Repository & { commit: string; wanted: (path: string) => boolean }): Promise<({ status: 'ok' } & TarFiles) | { status: 'error'; message: string }> {
  try {
    const bytes = await fetchBytes({ url: `https://codeload.github.com/${owner}/${repo}/tar.gz/${commit}`, timeout: 60_000 })
    // A gzip body starts with 1f 8b. Without it, fetch already decompressed the archive.
    const tar = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes, { maxOutputLength: MAX_TARBALL_BYTES }) : bytes
    if (tar.length > MAX_TARBALL_BYTES) throw new Error('the archive is larger than the limit')
    return { status: 'ok', ...readTarFiles({ tar, wanted }) }
  } catch (err) {
    return { status: 'error', message: `${owner}/${repo}@${commit}: ${(err as Error).message}` }
  }
}
