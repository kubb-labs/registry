/**
 * Checks a record against its pinned version, without running any of its code: the version exists,
 * and `kubb-extension.json` and the docs are read from the verified npm tarball, or from the archive
 * of a GitHub release's commit.
 */
import { fetchPackageFiles, MAX_FILE_BYTES } from './npmTarball.ts'
import type { ExtensionManifest, RegistryArtifact, RegistryGuide } from '@kubb/core'
import { DOCS_OVERVIEW_FILE, isDocsFile, readDocs } from './docs.ts'
import { fetchGitHubFiles, resolveTagCommit } from './github.ts'
import { githubPackageProblems } from './githubPackage.ts'
import { npmHasPackage } from './npm.ts'
import { overviewProblems } from './overview.ts'
import { registryTypeOf, validateManifest } from './records.ts'
import type { GitHubArtifact, RegistryRecord } from './types.ts'

const MANIFEST_FILE = 'kubb-extension.json'
const PACKAGE_FILE = 'package.json'
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

/** How messages name a pinned version: `@kubb/plugin-zod@5.4.4`, or `acme/kubb-plugin-x@v1.2.0` on GitHub. */
export function artifactLabel(artifact: RegistryArtifact): string {
  return artifact.kind === 'github' ? `${artifact.owner}/${artifact.repo}@${artifact.tag}` : `${artifact.package}@${artifact.version}`
}

/**
 * Parses and checks the manifest a version ships. A version without one is a problem only for a community record.
 */
function readManifest({
  record,
  label,
  text,
}: {
  record: RegistryRecord
  label: string
  text: string | undefined
}): Pick<ArtifactCheck, 'manifest' | 'problems'> {
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
 * The files a pinned version ships that the registry reads. A GitHub release also gives its root
 * `package.json` and the path of every committed file.
 */
function readArtifactFiles({ artifact, scope }: { artifact: RegistryArtifact; scope: string }) {
  return artifact.kind === 'github'
    ? fetchGitHubFiles({ ...artifact, wanted: (path) => path === PACKAGE_FILE || isPackageFile(path) })
    : fetchPackageFiles({ pkg: artifact.package, version: artifact.version, wanted: isPackageFile, scope })
}

/**
 * The problems with a GitHub release beyond its manifest and docs: its `package.json`, and with
 * `verifyPin`, that the tag still points to the pinned commit and that npm does not list the name.
 */
async function githubProblems({
  artifact,
  files,
  paths,
  verifyPin,
  scope,
}: {
  artifact: GitHubArtifact
  files: Map<string, string>
  paths: ReadonlySet<string>
  verifyPin: boolean
  scope: string
}): Promise<Array<string>> {
  const label = artifactLabel(artifact)
  const problems = githubPackageProblems({ artifact, text: files.get(PACKAGE_FILE), paths, manifest: files.has(MANIFEST_FILE) }).map(
    (problem) => `${label}: ${problem}`,
  )
  if (!verifyPin) return problems

  const [commit, onNpm] = await Promise.all([resolveTagCommit({ ...artifact, scope }), npmHasPackage({ pkg: artifact.package, scope })])
  if (commit !== artifact.commit)
    problems.push(commit ? `${label}: the tag points to ${commit}, not the pinned ${artifact.commit}` : `${label}: the repository has no such tag`)
  if (onNpm) problems.push(`${artifact.package} is on npm, so a GitHub record cannot use the name. Submit the npm package instead.`)
  if (onNpm === null) problems.push(`could not check whether npm lists ${artifact.package}`)
  return problems
}

/**
 * Reads the manifest and the docs from the pinned version and checks them. A version without a
 * manifest passes only for an official record released before manifests; the build leaves it out of
 * the index until a version ships one. An overview is required: the author's `docs/overview.md`, else
 * the root `OVERVIEW.md` of a version published before `docs/`, else the registry's
 * `extensions/<owner>/<slug>.md`. `docs/options.md` and `docs/guides/` are optional.
 */
export async function checkArtifact({
  record,
  registryOverview,
  verifyPin = true,
  scope = 'registry',
}: {
  record: RegistryRecord
  registryOverview: string | null
  /** For a GitHub release: also check the tag and npm, which the build skips to save API calls. */
  verifyPin?: boolean
  scope?: string
}): Promise<ArtifactCheck> {
  const { artifact } = record
  const label = artifactLabel(artifact)
  const read = await readArtifactFiles({ artifact, scope })
  if (read.status === 'error') return { manifest: null, authorOverview: null, options: null, guides: [], problems: [read.message] }

  const sizeProblems = read.tooLarge.map((path) => `${path} of ${label} is larger than ${MAX_FILE_BYTES / 1024} KiB, so it was not read`)
  const { manifest, problems } = readManifest({ record, label, text: read.files.get(MANIFEST_FILE) })
  const packageProblems = artifact.kind === 'github' ? await githubProblems({ artifact, files: read.files, paths: read.paths, verifyPin, scope }) : []
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
    problems: [...sizeProblems, ...problems, ...packageProblems, ...overviewIssues, ...docsIssues],
  }
}
