/**
 * Pure helpers shared by the build, submit, bump, and validate scripts.
 * Nothing here touches the network or the file system.
 */
import { Ajv } from 'ajv'
import addFormats from 'ajv-formats'
import manifestSchema from '../../schemas/kubb-extension.json' with { type: 'json' }
import recordSchema from '../../schemas/registry-record.json' with { type: 'json' }
import { manifestProblems } from './manifestChecks.ts'
import type { ExtensionManifest, RegistryRecord } from './types.ts'

/** Owners and slugs: lowercase words joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The owner whose records count as official. */
export const OFFICIAL_OWNER = 'kubb-labs'

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)
const validateRecordSchema = ajv.compile(recordSchema)
const validateManifestSchema = ajv.compile(manifestSchema)

function formatErrors(errors: typeof validateRecordSchema.errors): Array<string> {
  return (errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`)
}

/**
 * Turns a path below `extensions/` (`kubb-labs/plugin-zod.json`) into the record id it must hold.
 */
export function recordIdFromPath(relativePath: string): string | null {
  const match = relativePath.replaceAll('\\', '/').match(/^([^/]+)\/([^/]+)\.json$/)
  if (!match || !SLUG_PATTERN.test(match[1]!) || !SLUG_PATTERN.test(match[2]!)) return null
  return `${match[1]}/${match[2]}`
}

/**
 * The npm package name without its scope: `@kubb/plugin-zod` gives `plugin-zod`.
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
  return id.split('/')[0] === OFFICIAL_OWNER ? 'official' : 'community'
}

/**
 * A UTC timestamp to the second, as records store them: `2026-10-12T20:00:00Z`.
 */
export function toTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`
}

/**
 * Checks a record against the schema, the path it is stored at, and the known categories. Returns
 * the problems found, empty when the record is valid.
 */
export function validateRecord(record: unknown, relativePath: string, knownCategories: ReadonlySet<string>): Array<string> {
  if (!validateRecordSchema(record)) return formatErrors(validateRecordSchema.errors)
  const { id, artifact, repository, categories = [] } = record as RegistryRecord
  const errors: Array<string> = []
  for (const category of categories.filter((slug) => !knownCategories.has(slug))) errors.push(`/categories "${category}" is not in categories.json`)
  const expectedId = recordIdFromPath(relativePath)
  if (id !== expectedId) errors.push(`/id "${id}" must equal the path "${expectedId ?? relativePath}"`)
  const [owner, slug] = id.split('/')
  if (slug !== slugFromPackage(artifact.package))
    errors.push(`/id slug "${slug}" must equal the package name without its scope "${slugFromPackage(artifact.package)}"`)
  const repo = parseRepositoryUrl(repository.url)
  if (repo?.owner !== owner) errors.push(`/id owner "${owner}" must equal the repository owner "${repo?.owner ?? '?'}"`)
  return errors
}

/**
 * Checks a `kubb-extension.json` against its JSON Schema, then against the semantic checks the
 * schema cannot express (manifestChecks.ts). Returns the problems found, empty when valid.
 */
export function validateManifest(manifest: unknown): Array<string> {
  if (!validateManifestSchema(manifest)) return formatErrors(validateManifestSchema.errors)
  return manifestProblems(manifest)
}

/**
 * Applies a record's reviewer-owned fields over the manifest: the `listing` overrides, and the
 * main category, which replaces the manifest's `category`.
 */
export function applyListing(manifest: ExtensionManifest, record: Pick<RegistryRecord, 'listing' | 'categories'>): ExtensionManifest {
  const category = record.categories?.[0]
  return { ...manifest, ...record.listing, ...(category ? { category } : {}) }
}

/**
 * Checks the record dates against the record as it was listed before this change (`undefined`
 * for a new record): `submittedAt` and `publishedAt` never change, and every date a change writes
 * is a UTC timestamp to the second.
 */
export function recordDateProblems(record: RegistryRecord, listed: Record<string, unknown> | undefined): Array<string> {
  const problems: Array<string> = []
  for (const key of ['submittedAt', 'publishedAt'] as const) {
    if (listed && listed[key] !== record[key]) problems.push(`${key} must stay ${JSON.stringify(listed[key])}; an update moves reviewedAt only`)
  }
  for (const key of ['submittedAt', 'publishedAt', 'reviewedAt'] as const) {
    if (record[key] !== listed?.[key] && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(record[key])) {
      problems.push(`${key} must be a UTC timestamp to the second, such as ${toTimestamp(new Date())}`)
    }
  }
  if (listed && typeof listed.reviewedAt === 'string' && record.reviewedAt < listed.reviewedAt) problems.push('reviewedAt must not move back')
  return problems
}

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

/**
 * Compares two semver versions by precedence: negative when `a` is lower, positive when higher,
 * 0 when equal. Throws on a version that is not semver.
 */
export function compareVersions(a: string, b: string): number {
  const [left, right] = [a, b].map((version) => {
    const match = version.match(VERSION_PATTERN)
    if (!match) throw new Error(`"${version}" is not a semver version`)
    return match
  }) as [RegExpMatchArray, RegExpMatchArray]
  for (const index of [1, 2, 3]) {
    const diff = Number(left[index]) - Number(right[index])
    if (diff !== 0) return Math.sign(diff)
  }
  const [preA, preB] = [left[4], right[4]]
  if (preA === preB) return 0
  // A release ranks above any prerelease of the same version.
  if (preA === undefined) return 1
  if (preB === undefined) return -1
  const partsA = preA.split('.')
  const partsB = preB.split('.')
  for (let index = 0; index < Math.max(partsA.length, partsB.length); index++) {
    const [partA, partB] = [partsA[index], partsB[index]]
    if (partA === undefined) return -1
    if (partB === undefined) return 1
    if (partA === partB) continue
    const [numA, numB] = [/^\d+$/.test(partA), /^\d+$/.test(partB)]
    if (numA && numB) return Math.sign(Number(partA) - Number(partB))
    if (numA) return -1
    if (numB) return 1
    return partA < partB ? -1 : 1
  }
  return 0
}

/**
 * Moves a record's pin to `latest` when that is newer, and stamps `reviewedAt`. Returns null when
 * the record is already current. `submittedAt` and `publishedAt` never change.
 */
export function bumpRecord(record: RegistryRecord, latest: string, now: Date): RegistryRecord | null {
  if (compareVersions(latest, record.artifact.version) <= 0) return null
  return { ...record, artifact: { ...record.artifact, version: latest }, reviewedAt: toTimestamp(now) }
}

/**
 * Stamps a record as approved at `now`: `reviewedAt` always, and `publishedAt` too when the record
 * is not listed yet. `submittedAt` never changes.
 */
export function approveRecord(record: RegistryRecord, listed: boolean, now: Date): RegistryRecord {
  const timestamp = toTimestamp(now)
  return { ...record, ...(listed ? {} : { publishedAt: timestamp }), reviewedAt: timestamp }
}
