/**
 * Pure helpers shared by the build, submit, bump, and validate scripts.
 * Nothing here touches the network or the file system.
 */
import { Ajv } from 'ajv'
import addFormats from 'ajv-formats'
import { type ExtensionManifest, manifestProblems } from '@kubb/core'
import manifestSchema from '@kubb/core/schemas/kubb-extension.json' with { type: 'json' }
import recordSchema from '../../schemas/registry-record.json' with { type: 'json' }
import type { GitHubArtifact, RegistryRecord } from './types.ts'

/** Owners and slugs: lowercase words joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Owners no record may use: kubb.dev serves `/extensions/<owner>/<slug>`, and these two are its
 * filter pages, `/extensions/kind/<kind>` and `/extensions/category/<slug>`.
 */
const RESERVED_OWNERS = new Set(['kind', 'category'])

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)
const validateRecordSchema = ajv.compile(recordSchema)
const validateManifestSchema = ajv.compile(manifestSchema)

function formatErrors(errors: typeof validateRecordSchema.errors): Array<string> {
  return (errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`)
}

/**
 * The package name without its scope: `@kubb/plugin-zod` gives `plugin-zod`.
 */
export function slugFromPackage(pkg: string): string {
  return pkg.replace(/^@[^/]+\//, '')
}

/**
 * The GitHub owner and repository of a `https://github.com/<owner>/<repo>[/...]` URL, or null.
 * The owner is lowercased, since GitHub treats owners case-insensitively and record ids are lowercase.
 */
export function parseRepositoryUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?(?:\/.*)?$/)
  if (!match) return null
  return { owner: match[1]!.toLowerCase(), repo: match[2]! }
}

/**
 * `official` for records owned by kubb-labs, `community` for everyone else.
 */
export function registryTypeOf(id: string): 'official' | 'community' {
  return id.split('/')[0] === 'kubb-labs' ? 'official' : 'community'
}

/**
 * A UTC timestamp to the second, as records store them: `2026-10-12T20:00:00Z`.
 */
export function toTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`
}

/**
 * Checks a record against the schema, the path it is stored at (`kubb-labs/plugin-zod.json`), and
 * the known categories. Returns the problems found, empty when the record is valid.
 */
export function validateRecord({
  record,
  relativePath,
  knownCategories,
}: {
  record: unknown
  relativePath: string
  knownCategories: ReadonlySet<string>
}): Array<string> {
  if (!validateRecordSchema(record)) return formatErrors(validateRecordSchema.errors)
  const { id, artifact, repository, categories = [] } = record as RegistryRecord
  const errors = categories.filter((slug) => !knownCategories.has(slug)).map((slug) => `/categories "${slug}" is not in categories.json`)
  const pathId = relativePath.replaceAll('\\', '/').replace(/\.json$/, '')
  if (id !== pathId) errors.push(`/id "${id}" must equal the path "${pathId}"`)
  const [owner, slug] = id.split('/')
  if (RESERVED_OWNERS.has(owner!)) errors.push(`/id owner "${owner}" is reserved for kubb.dev's /extensions/${owner}/ pages`)
  const packageSlug = slugFromPackage(artifact.package)
  if (slug !== packageSlug) errors.push(`/id slug "${slug}" must equal the package name without its scope "${packageSlug}"`)
  const repo = parseRepositoryUrl(repository.url)
  if (repo?.owner !== owner) errors.push(`/id owner "${owner}" must equal the repository owner "${repo?.owner ?? '?'}"`)
  if (artifact.kind === 'github') errors.push(...githubArtifactProblems({ artifact, repositoryUrl: repository.url }))
  return errors
}

/**
 * Checks a GitHub artifact against its record: the package installs from the repository root, the
 * tag names the version, and a scoped name uses the owner as its scope, so it cannot pass for
 * another owner's package such as `@kubb/...`.
 */
function githubArtifactProblems({ artifact, repositoryUrl }: { artifact: GitHubArtifact; repositoryUrl: string }): Array<string> {
  const errors: Array<string> = []
  const root = `https://github.com/${artifact.owner}/${artifact.repo}`
  if (repositoryUrl !== root) errors.push(`/repository/url must be "${root}", the repository root the GitHub artifact installs from`)
  if (artifact.tag !== artifact.version && artifact.tag !== `v${artifact.version}`)
    errors.push(`/artifact/tag "${artifact.tag}" must be "v${artifact.version}" or "${artifact.version}"`)
  const scope = artifact.package.match(/^@([^/]+)\//)?.[1]
  if (scope !== undefined && scope !== artifact.owner) errors.push(`/artifact/package scope "@${scope}" must be the repository owner "@${artifact.owner}"`)
  return errors
}

/**
 * Checks a `kubb-extension.json` against the JSON Schema `@kubb/core` ships, then against the
 * semantic checks the schema cannot express (`manifestProblems`). Returns the problems found, empty when valid.
 */
export function validateManifest(manifest: unknown): Array<string> {
  if (!validateManifestSchema(manifest)) return formatErrors(validateManifestSchema.errors)
  return manifestProblems(manifest as ExtensionManifest)
}

/**
 * Applies a record's reviewer-owned fields over the manifest: the `listing` overrides, and the
 * main category, which replaces the manifest's `category`.
 */
export function applyListing({ manifest, record }: { manifest: ExtensionManifest; record: Pick<RegistryRecord, 'listing' | 'categories'> }): ExtensionManifest {
  const category = record.categories?.[0]
  return { ...manifest, ...record.listing, ...(category ? { category } : {}) }
}

/**
 * Checks a schema-valid record's dates against the record as it was listed before this change
 * (`undefined` for a new record): `submittedAt` and `publishedAt` never change, and `reviewedAt`
 * never moves back.
 */
export function recordDateProblems({ record, listed }: { record: RegistryRecord; listed: Record<string, unknown> | undefined }): Array<string> {
  if (!listed) return []
  const problems = (['submittedAt', 'publishedAt'] as const)
    .filter((key) => listed[key] !== record[key])
    .map((key) => `${key} must stay ${JSON.stringify(listed[key])}; an update moves reviewedAt only`)
  if (typeof listed.reviewedAt === 'string' && record.reviewedAt < listed.reviewedAt) problems.push('reviewedAt must not move back')
  return problems
}

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

/**
 * Semver precedence of `a` against `b`: negative when lower, positive when higher, 0 when equal.
 * Throws on a version that is not semver.
 */
function compareVersions({ a, b }: { a: string; b: string }): number {
  const [left, right] = [a, b].map((version) => {
    const match = version.match(VERSION_PATTERN)
    if (!match) throw new Error(`"${version}" is not a semver version`)
    return match
  }) as [RegExpMatchArray, RegExpMatchArray]
  for (const index of [1, 2, 3]) {
    const diff = Number(left[index]) - Number(right[index])
    if (diff !== 0) return Math.sign(diff)
  }
  const [preA, preB] = [left[4]?.split('.'), right[4]?.split('.')]
  // A release ranks above any prerelease of the same version.
  if (!preA || !preB) return Number(!preA) - Number(!preB)
  for (let index = 0; index < Math.max(preA.length, preB.length); index++) {
    const [partA, partB] = [preA[index], preB[index]]
    if (partA === partB) continue
    if (partA === undefined) return -1
    if (partB === undefined) return 1
    const [numA, numB] = [/^\d+$/.test(partA), /^\d+$/.test(partB)]
    if (numA && numB) return Math.sign(Number(partA) - Number(partB))
    if (numA !== numB) return numA ? -1 : 1
    return partA < partB ? -1 : 1
  }
  return 0
}

/**
 * Moves a record's pin to `latest` when that is newer, and stamps `reviewedAt`. A GitHub record also
 * takes the release's `pin`: its tag and commit. Returns null when the record is already current.
 * `submittedAt` and `publishedAt` never change.
 */
export function bumpRecord({
  record,
  latest,
  pin,
  now,
}: {
  record: RegistryRecord
  latest: string
  pin?: Pick<GitHubArtifact, 'tag' | 'commit'>
  now: Date
}): RegistryRecord | null {
  if (compareVersions({ a: latest, b: record.artifact.version }) <= 0) return null
  return { ...record, artifact: { ...record.artifact, version: latest, ...pin }, reviewedAt: toTimestamp(now) }
}

/**
 * Stamps a record as approved at `now`: `reviewedAt` always, and `publishedAt` too when the record
 * is not listed yet. `submittedAt` never changes.
 */
export function approveRecord({ record, listed, now }: { record: RegistryRecord; listed: boolean; now: Date }): RegistryRecord {
  const timestamp = toTimestamp(now)
  return { ...record, ...(listed ? {} : { publishedAt: timestamp }), reviewedAt: timestamp }
}
