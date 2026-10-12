import { checkArtifact } from './check.ts'
import { fetchRepoStars } from './github.ts'
import type { LoadedRecord } from './load.ts'
import { fetchNpmDownloads } from './npm.ts'
import { log, warn } from './paths.ts'
import { applyListing, parseRepositoryUrl, registryTypeOf, toTimestamp } from './records.ts'
import type { RegistryDetail, RegistryEntry, RegistryIndex, RegistryRecord } from './types.ts'

const SCOPE = 'build'

/** `<owner>/<repo>` of a GitHub repository URL, which may point at a folder inside it. */
function repoSlug(url: string): string | undefined {
  const repo = parseRepositoryUrl(url)
  return repo ? `${repo.owner}/${repo.repo}` : undefined
}

/**
 * Monthly and weekly npm downloads and GitHub stars. Unavailable numbers are left out, so an
 * unreachable API never reads as zero.
 */
async function fetchStats({ record, stars }: { record: RegistryRecord; stars: Map<string, number | undefined> }): Promise<RegistryEntry['stats']> {
  const pkg = record.artifact.package
  const [downloads, weekly] = await Promise.all([
    fetchNpmDownloads({ pkg, period: 'last-month', scope: SCOPE }),
    fetchNpmDownloads({ pkg, period: 'last-week', scope: SCOPE }),
  ])
  const slug = repoSlug(record.repository.url)
  const stats = { downloads, weekly, stars: slug ? stars.get(slug) : undefined }
  return Object.values(stats).some((value) => value !== undefined) ? stats : undefined
}

async function resolveRecord({
  loaded: { record, registryOverview },
  stars,
}: {
  loaded: LoadedRecord
  stars: Map<string, number | undefined>
}): Promise<RegistryDetail | null> {
  const { manifest, authorOverview, problems } = await checkArtifact({ record, registryOverview, scope: SCOPE })
  for (const problem of problems) warn({ scope: SCOPE, message: `${record.id}: ${problem}` })
  if (!manifest) {
    warn({
      scope: SCOPE,
      message: `${record.id}: ${record.artifact.package}@${record.artifact.version} ships no valid kubb-extension.json, left out of the index`,
    })
    return null
  }

  const merged = applyListing({ manifest, record })
  const entry: RegistryEntry = {
    id: record.id,
    kind: merged.kind,
    type: registryTypeOf(record.id),
    artifact: record.artifact,
    repository: record.repository,
    manifest: merged,
    submittedAt: record.submittedAt,
    publishedAt: record.publishedAt,
    reviewedAt: record.reviewedAt,
  }
  const stats = await fetchStats({ record, stars })
  if (stats) entry.stats = stats
  return { ...entry, overview: authorOverview ?? registryOverview }
}

/**
 * Reads every record's pinned version and returns the index and the detail documents, sorted by id.
 * Records whose version ships no valid manifest are left out, with a warning.
 */
export async function buildRegistry(records: Array<LoadedRecord>): Promise<{ index: RegistryIndex; details: Array<RegistryDetail> }> {
  log({ scope: SCOPE, message: `reading ${records.length} pinned npm versions…` })
  const slugs = new Set(records.flatMap(({ record }) => repoSlug(record.repository.url) ?? []))
  const stars = new Map(await Promise.all([...slugs].map(async (slug) => [slug, await fetchRepoStars({ slug, scope: SCOPE })] as const)))

  const details = (await Promise.all(records.map((loaded) => resolveRecord({ loaded, stars })))).filter((detail) => detail !== null)
  details.sort((a, b) => a.id.localeCompare(b.id))
  const index: RegistryIndex = {
    version: 1,
    generatedAt: toTimestamp(new Date()),
    extensions: details.map(({ overview: _overview, ...entry }) => entry),
  }
  return { index, details }
}
