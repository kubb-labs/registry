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
export async function checkArtifact(record: RegistryRecord, registryOverview: string | null, scope = 'registry'): Promise<ArtifactCheck> {
  const { package: pkg, version } = record.artifact
  const read = await fetchPackageFiles({ pkg, version, files: [MANIFEST_FILE, OVERVIEW_FILE], scope })
  if (read.status === 'error') return { manifest: null, authorOverview: null, problems: [read.message] }

  const problems: Array<string> = []
  let manifest: ExtensionManifest | null = null
  const manifestText = read.files.get(MANIFEST_FILE)
  if (manifestText === undefined) {
    if (registryTypeOf(record.id) === 'community') problems.push(`${pkg}@${version} ships no ${MANIFEST_FILE}`)
  } else {
    let parsed: unknown
    try {
      parsed = JSON.parse(manifestText)
    } catch {
      problems.push(`${MANIFEST_FILE} of ${pkg}@${version} is not valid JSON`)
    }
    if (parsed !== undefined) {
      const errors = validateManifest(parsed)
      problems.push(...errors.map((error) => `${MANIFEST_FILE} of ${pkg}@${version}: ${error}`))
      if (!errors.length) manifest = parsed as ExtensionManifest
    }
  }

  const authorOverview = read.files.get(OVERVIEW_FILE) ?? null
  const overview = authorOverview ?? registryOverview
  if (overview === null) problems.push(`${pkg}@${version} ships no ${OVERVIEW_FILE}; add extensions/${record.id}.md`)
  else
    problems.push(
      ...overviewProblems(overview).map(
        (problem) => `${authorOverview !== null ? `${OVERVIEW_FILE} of ${pkg}@${version}` : `extensions/${record.id}.md`}: ${problem}`,
      ),
    )

  return { manifest, authorOverview, problems }
}
