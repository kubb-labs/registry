import { checkArtifact } from './check.ts'
import { fetchJson } from './http.ts'
import type { LoadedRecord } from './load.ts'
import { applyListing, parseRepositoryUrl, registryTypeOf, toTimestamp } from './records.ts'
import type { RegistryDetail, RegistryIndex } from '@kubb/core/manifest'

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

async function resolveRecord({
  loaded: { record, registryOverview },
  stars,
}: {
  loaded: LoadedRecord
  stars: Map<string, number | undefined>
}): Promise<RegistryDetail | null> {
  const { package: pkg, version } = record.artifact
  const { manifest, authorOverview, problems } = await checkArtifact({ record, registryOverview, scope })
  for (const problem of problems) console.warn(`[${scope}] ⚠ ${record.id}: ${problem}`)
  if (!manifest) {
    console.warn(`[${scope}] ⚠ ${record.id}: ${pkg}@${version} ships no valid kubb-extension.json, left out of the index`)
    return null
  }

  const [downloads, weekly] = await Promise.all(
    ['last-month', 'last-week'].map((period) => fetchCount({ url: `https://api.npmjs.org/downloads/point/${period}/${pkg}`, key: 'downloads' })),
  )
  const slug = repoSlug(record.repository.url)
  const stats = { downloads, weekly, stars: slug ? stars.get(slug) : undefined }
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
  }
}

/**
 * Reads every record's pinned version and returns the index and the detail documents, sorted by id.
 * Records whose version ships no valid manifest are left out, with a warning.
 */
export async function buildRegistry(records: Array<LoadedRecord>): Promise<{ index: RegistryIndex; details: Array<RegistryDetail> }> {
  console.log(`[${scope}] reading ${records.length} pinned npm versions…`)
  // One request per repository, since many records share one.
  const slugs = [...new Set(records.flatMap(({ record }) => repoSlug(record.repository.url) ?? []))]
  const counts = await Promise.all(
    slugs.map((slug) => fetchCount({ url: `https://api.github.com/repos/${slug}`, key: 'stargazers_count', headers: githubHeaders })),
  )
  const stars = new Map(slugs.map((slug, index) => [slug, counts[index]]))

  const details = (await Promise.all(records.map((loaded) => resolveRecord({ loaded, stars })))).filter((detail) => detail !== null)
  details.sort((a, b) => a.id.localeCompare(b.id))
  const index: RegistryIndex = {
    version: 1,
    generatedAt: toTimestamp(new Date()),
    extensions: details.map(({ overview: _overview, ...entry }) => entry),
  }
  return { index, details }
}
