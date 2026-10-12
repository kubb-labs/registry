import { existsSync, globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { overviewProblems } from './manifestChecks.ts'
import { validateRecord } from './records.ts'
import { EXTENSIONS_DIR, fromRoot } from './paths.ts'
import type { RegistryCategory, RegistryRecord } from './types.ts'

export type LoadedRecord = {
  record: RegistryRecord
  /** Relative to `extensions/`, e.g. `kubb-labs/plugin-zod.json`. */
  path: string
  /** `extensions/<owner>/<slug>.md`, used while the pinned version ships no `OVERVIEW.md`. */
  registryOverview: string | null
}

/**
 * Reads `categories.json`.
 */
export function loadCategories(): Array<RegistryCategory> {
  return JSON.parse(readFileSync(fromRoot('categories.json'), 'utf8')) as Array<RegistryCategory>
}

/**
 * Reads and checks every record below `extensions/`, without the network: the schema, the id
 * against the path, known categories, one record per package, and the registry overviews.
 * Throws naming each problem.
 */
export function loadRecords(): Array<LoadedRecord> {
  const dir = fromRoot(EXTENSIONS_DIR)
  const known = new Set(loadCategories().map((category) => category.slug))
  const problems: Array<string> = []
  const records: Array<LoadedRecord> = []

  for (const path of globSync('*/*.json', { cwd: dir }).toSorted()) {
    let record: unknown
    try {
      record = JSON.parse(readFileSync(join(dir, path), 'utf8'))
    } catch (err) {
      problems.push(`${EXTENSIONS_DIR}/${path}: ${(err as Error).message}`)
      continue
    }
    const errors = validateRecord(record, path, known)
    if (errors.length) {
      problems.push(...errors.map((error) => `${EXTENSIONS_DIR}/${path}: ${error}`))
      continue
    }
    const overviewPath = join(dir, path.replace(/\.json$/, '.md'))
    const registryOverview = existsSync(overviewPath) ? readFileSync(overviewPath, 'utf8') : null
    if (registryOverview !== null)
      problems.push(...overviewProblems(registryOverview).map((problem) => `${EXTENSIONS_DIR}/${path.replace(/\.json$/, '.md')}: ${problem}`))
    records.push({ record: record as RegistryRecord, path, registryOverview })
  }

  for (const path of globSync('*/*.md', { cwd: dir })) {
    if (!existsSync(join(dir, path.replace(/\.md$/, '.json')))) problems.push(`${EXTENSIONS_DIR}/${path}: no record has this overview`)
  }
  const byPackage = Map.groupBy(records, ({ record }) => record.artifact.package)
  for (const [pkg, listed] of byPackage) {
    if (listed.length > 1) problems.push(`${pkg} is listed by more than one record: ${listed.map(({ record }) => record.id).join(', ')}`)
  }

  if (problems.length) throw new Error(`invalid registry records:\n${problems.join('\n')}`)
  return records
}
