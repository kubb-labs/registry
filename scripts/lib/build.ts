import { checkArtifact } from './check.ts'
import { fetchJson } from './http.ts'
import type { LoadedRecord } from './load.ts'
import { applyListing, parseRepositoryUrl, registryTypeOf, toTimestamp } from './records.ts'
import type { RegistryDetail, RegistryIndex } from '@kubb/core'

const scope = 'build'

const githubHeaders = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'kubb-labs-registry',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
}

/** `<owner>/<repo>` of a GitHub repository URL, which may point at a folder inside it. */
function repoSlug(url: string): string | undefined {
  const repo = parseRepositoryUrl(url)
  return repo ? `${repo.owner}/${repo.repo}` : undefined
}

/**
 * The number under `key` in the JSON at `url`, or undefined when it cannot be read, so an
 * unreachable API never reads as zero.
 */
async function fetchCount({ url, key, headers }: { url: string; key: string; headers?: Record<string, string> }): Promise<number | undefined> {
  const data = await fetchJson<Record<string, number | undefined>>({ url, headers, scope })
  return data ? (data[key] ?? 0) : undefined
}

type Downloads = { downloads?: number; weekly?: number }

/**
 * Downloads over the last 30 days and over the last 7 of them, from one npm request. Both are
 * undefined when npm cannot be read.
 */
async function fetchDownloads(pkg: string): Promise<Downloads> {
  const data = await fetchJson<{ downloads?: Array<{ downloads: number }> }>({ url: `https://api.npmjs.org/downloads/range/last-month/${pkg}`, scope })
  if (!data) return {}
  const days = (data.downloads ?? []).map((day) => day.downloads)
  const total = (counts: Array<number>) => counts.reduce((sum, count) => sum + count, 0)
  return { downloads: total(days), weekly: total(days.slice(-7)) }
}

async function resolveRecord({
  loaded: { record, registryOverview },
  downloads,
  stars,
}: {
  loaded: LoadedRecord
  downloads: Map<string, Downloads>
  stars: Map<string, number | undefined>
}): Promise<RegistryDetail | null> {
  const { package: pkg, version } = record.artifact
  const { manifest, authorOverview, options, guides, problems } = await checkArtifact({ record, registryOverview, scope })
  for (const problem of problems) console.warn(`[${scope}] ⚠ ${record.id}: ${problem}`)
  if (!manifest) {
    console.warn(`[${scope}] ⚠ ${record.id}: ${pkg}@${version} ships no valid kubb-extension.json, left out of the index`)
    return null
  }

  const slug = repoSlug(record.repository.url)
  const stats = { ...downloads.get(pkg), stars: slug ? stars.get(slug) : undefined }
  const merged = applyListing({ manifest, record })
  return {
    id: record.id,
    kind: merged.kind,
    type: registryTypeOf(record.id),
    artifact: record.artifact,
    repository: record.repository,
    manifest: merged,
    submittedAt: record.submittedAt,
    publishedAt: record.publishedAt,
    reviewedAt: record.reviewedAt,
    ...(Object.values(stats).some((value) => value !== undefined) && { stats }),
    overview: authorOverview ?? registryOverview,
    options,
    guides,
  }
}

/**
 * Reads every record's pinned version and returns the index and the detail documents, sorted by id.
 * A detail holds the overview, the options page, and the guides; the index leaves them out.
 * Records whose version ships no valid manifest are left out, with a warning. A docs problem is only
 * a warning.
 */
export async function buildRegistry(records: Array<LoadedRecord>): Promise<{ index: RegistryIndex; details: Array<RegistryDetail> }> {
  console.log(`[${scope}] reading ${records.length} pinned npm versions…`)
  // One request per repository, since many records share one.
  const slugs = [...new Set(records.flatMap(({ record }) => repoSlug(record.repository.url) ?? []))]
  const counts = await Promise.all(
    slugs.map((slug) => fetchCount({ url: `https://api.github.com/repos/${slug}`, key: 'stargazers_count', headers: githubHeaders })),
  )
  const stars = new Map(slugs.map((slug, index) => [slug, counts[index]]))
  // One package at a time, since npm rate-limits its downloads API.
  const downloads = new Map<string, Downloads>()
  for (const { record } of records) downloads.set(record.artifact.package, await fetchDownloads(record.artifact.package))

  const details = (await Promise.all(records.map((loaded) => resolveRecord({ loaded, downloads, stars })))).filter((detail) => detail !== null)
  details.sort((a, b) => a.id.localeCompare(b.id))
  const index: RegistryIndex = {
    version: 1,
    generatedAt: toTimestamp(new Date()),
    extensions: details.map(({ overview: _overview, options: _options, guides: _guides, ...entry }) => entry),
  }
  return { index, details }
}
