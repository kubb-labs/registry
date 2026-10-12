/**
 * Checks a record against its pinned npm version, without running any of its code: the version
 * exists, and `kubb-extension.json` and `OVERVIEW.md` are read from the verified npm tarball.
 */
import { fetchPackageFiles } from './npmTarball.ts'
import { overviewProblems } from './manifestChecks.ts'
import { registryTypeOf, validateManifest } from './records.ts'
import type { ExtensionManifest, RegistryRecord } from './types.ts'

export const MANIFEST_FILE = 'kubb-extension.json'
export const OVERVIEW_FILE = 'OVERVIEW.md'

/**
 * What the pinned version ships: its manifest when valid, its author overview, and the problems found.
 */
export type ArtifactCheck = {
  manifest: ExtensionManifest | null
  authorOverview: string | null
  problems: Array<string>
}

/**
 * Reads the manifest and the overview from the pinned npm tarball and checks them. A version
 * without a manifest passes only for an official record released before manifests; the build leaves it
 * out of the index until a version ships one. An overview is required: the author's `OVERVIEW.md`, or
 * else the registry's `extensions/<owner>/<slug>.md`.
 */
export async function checkArtifact({
  record,
  registryOverview,
  scope = 'registry',
}: {
  record: RegistryRecord
  registryOverview: string | null
  scope?: string
}): Promise<ArtifactCheck> {
  const { package: pkg, version } = record.artifact
  const read = await fetchPackageFiles({ pkg, version, files: [MANIFEST_FILE, OVERVIEW_FILE], scope })
  if (read.status === 'error') return { manifest: null, authorOverview: null, problems: [read.message] }

  const { manifest, problems } = readManifest({ record, text: read.files.get(MANIFEST_FILE) })
  const authorOverview = read.files.get(OVERVIEW_FILE) ?? null
  return { manifest, authorOverview, problems: [...problems, ...checkOverview({ record, authorOverview, registryOverview })] }
}

/**
 * Parses and checks the manifest a version ships. A version without one is a problem only for a community record.
 */
function readManifest({ record, text }: { record: RegistryRecord; text: string | undefined }): { manifest: ExtensionManifest | null; problems: Array<string> } {
  const { package: pkg, version } = record.artifact
  if (text === undefined) return { manifest: null, problems: registryTypeOf(record.id) === 'community' ? [`${pkg}@${version} ships no ${MANIFEST_FILE}`] : [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { manifest: null, problems: [`${MANIFEST_FILE} of ${pkg}@${version} is not valid JSON`] }
  }
  const errors = validateManifest(parsed)
  return {
    manifest: errors.length ? null : (parsed as ExtensionManifest),
    problems: errors.map((error) => `${MANIFEST_FILE} of ${pkg}@${version}: ${error}`),
  }
}

/**
 * Checks the overview the listing uses: the author's `OVERVIEW.md`, or else the registry copy.
 */
function checkOverview({
  record,
  authorOverview,
  registryOverview,
}: {
  record: RegistryRecord
  authorOverview: string | null
  registryOverview: string | null
}): Array<string> {
  const { package: pkg, version } = record.artifact
  const overview = authorOverview ?? registryOverview
  if (overview === null) return [`${pkg}@${version} ships no ${OVERVIEW_FILE}; add extensions/${record.id}.md`]
  const source = authorOverview === null ? `extensions/${record.id}.md` : `${OVERVIEW_FILE} of ${pkg}@${version}`
  return overviewProblems(overview).map((problem) => `${source}: ${problem}`)
}
