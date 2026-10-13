/**
 * Checks a record against its pinned npm version, without running any of its code: the version
 * exists, and `kubb-extension.json` and the docs are read from the verified npm tarball.
 */
import { fetchPackageFiles, MAX_FILE_BYTES } from './npmTarball.ts'
import type { ExtensionManifest, RegistryGuide } from '@kubb/core'
import { DOCS_OVERVIEW_FILE, isDocsFile, readDocs } from './docs.ts'
import { overviewProblems } from './overview.ts'
import { registryTypeOf, validateManifest } from './records.ts'
import type { RegistryRecord } from './types.ts'

const MANIFEST_FILE = 'kubb-extension.json'
/** Where versions published before `docs/` ship their overview. */
const ROOT_OVERVIEW_FILE = 'OVERVIEW.md'

/**
 * What the pinned version ships: its manifest when valid, its author overview, options page, and
 * guides, and the problems found.
 */
type ArtifactCheck = {
  manifest: ExtensionManifest | null
  /** `docs/overview.md`, else the root `OVERVIEW.md`. */
  authorOverview: string | null
  options: string | null
  guides: Array<RegistryGuide>
  problems: Array<string>
}

/**
 * Parses and checks the manifest a version ships. A version without one is a problem only for a community record.
 */
function readManifest({ record, text }: { record: RegistryRecord; text: string | undefined }): Pick<ArtifactCheck, 'manifest' | 'problems'> {
  const label = `${record.artifact.package}@${record.artifact.version}`
  if (text === undefined) return { manifest: null, problems: registryTypeOf(record.id) === 'community' ? [`${label} ships no ${MANIFEST_FILE}`] : [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { manifest: null, problems: [`${MANIFEST_FILE} of ${label} is not valid JSON`] }
  }
  const errors = validateManifest(parsed)
  return { manifest: errors.length ? null : (parsed as ExtensionManifest), problems: errors.map((error) => `${MANIFEST_FILE} of ${label}: ${error}`) }
}

/**
 * The files the registry reads from a package: the manifest, the docs, and a root overview.
 */
function isPackageFile(path: string): boolean {
  return path === MANIFEST_FILE || path === ROOT_OVERVIEW_FILE || isDocsFile(path)
}

/**
 * Reads the manifest and the docs from the pinned npm tarball and checks them. A version without a
 * manifest passes only for an official record released before manifests; the build leaves it out of
 * the index until a version ships one. An overview is required: the author's `docs/overview.md`, else
 * the root `OVERVIEW.md` of a version published before `docs/`, else the registry's
 * `extensions/<owner>/<slug>.md`. `docs/options.md` and `docs/guides/` are optional.
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
  const label = `${pkg}@${version}`
  const read = await fetchPackageFiles({ pkg, version, wanted: isPackageFile, scope })
  if (read.status === 'error') return { manifest: null, authorOverview: null, options: null, guides: [], problems: [read.message] }

  const sizeProblems = read.tooLarge.map((path) => `${path} of ${label} is larger than ${MAX_FILE_BYTES / 1024} KiB, so it was not read`)
  const { manifest, problems } = readManifest({ record, text: read.files.get(MANIFEST_FILE) })
  const docs = readDocs(read.files)
  const docsIssues = docs.problems.map(({ path, problem }) => `${path} of ${label}: ${problem}`)

  const rootOverview = read.files.get(ROOT_OVERVIEW_FILE) ?? null
  const authorOverview = docs.overview ?? rootOverview
  const overview = [
    { source: `${DOCS_OVERVIEW_FILE} of ${label}`, text: docs.overview },
    { source: `${ROOT_OVERVIEW_FILE} of ${label}`, text: rootOverview },
    { source: `extensions/${record.id}.md`, text: registryOverview },
  ].find((candidate): candidate is { source: string; text: string } => candidate.text !== null)
  const overviewIssues = overview
    ? overviewProblems(overview.text).map((problem) => `${overview.source}: ${problem}`)
    : [`${label} ships no ${DOCS_OVERVIEW_FILE}. Add extensions/${record.id}.md.`]
  return {
    manifest,
    authorOverview,
    options: docs.options,
    guides: docs.guides,
    problems: [...sizeProblems, ...problems, ...overviewIssues, ...docsIssues],
  }
}
