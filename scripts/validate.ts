/**
 * Validates the registry. Never installs, imports, or runs an extension.
 *
 * Offline, every record: the schema, the id against the path, known categories, one record per
 * package, and the registry overviews. With `--changed`, the dates of records changed since the
 * merge base with `--base` (default `origin/main`): `submittedAt` and `publishedAt` never change.
 *
 * Online (`--online`), the changed records or every record: the pinned npm version exists, and the
 * `kubb-extension.json` and `OVERVIEW.md` read from its verified tarball pass the schema, the
 * semantic checks, and the overview rules.
 *
 * Usage: node scripts/validate.ts [--online] [--changed] [--base <ref>]
 */
import { parseArgs } from 'node:util'
import { changedRecordIds, mergeBase, recordAt } from './lib/changes.ts'
import { checkArtifact } from './lib/check.ts'
import { type LoadedRecord, loadRecords } from './lib/load.ts'
import { EXTENSIONS_DIR } from './lib/paths.ts'
import { recordDateProblems } from './lib/records.ts'

const { values } = parseArgs({ options: { online: { type: 'boolean' }, changed: { type: 'boolean' }, base: { type: 'string' } } })

function fail(problems: Array<string>): never {
  console.error(`✗ ${problems.length} problem(s) in the registry:\n${problems.join('\n')}`)
  process.exit(1)
}

let records: Array<LoadedRecord>
try {
  records = loadRecords()
} catch (err) {
  fail([(err as Error).message])
}
console.log(`✓ ${records.length} record(s) are well-formed`)

let selected = records
if (values.changed) {
  const base = mergeBase(values.base ?? 'origin/main')
  const changed = changedRecordIds(base)
  selected = records.filter(({ record }) => changed.has(record.id))
  const dateProblems = selected.flatMap(({ record, path }) =>
    recordDateProblems(record, recordAt(base, record.id)).map((problem) => `${EXTENSIONS_DIR}/${path}: ${problem}`),
  )
  if (dateProblems.length) fail(dateProblems)
  console.log(`✓ ${selected.length} changed record(s) keep their dates`)
}

if (values.online) {
  const problems = (
    await Promise.all(
      selected.map(async ({ record, path, registryOverview }) =>
        (await checkArtifact(record, registryOverview)).problems.map((problem) => `${EXTENSIONS_DIR}/${path}: ${problem}`),
      ),
    )
  ).flat()
  if (problems.length) fail(problems)
  console.log(`✓ ${selected.length} record(s) match their pinned npm versions`)
}
