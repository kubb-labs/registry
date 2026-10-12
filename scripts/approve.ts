/**
 * Stamps the records a pull request adds or changes as approved now: `reviewedAt` on every one,
 * and `publishedAt` on new ones. The reviewer runs it on the pull request branch right before
 * merging (REVIEW.md), so the dates say when the version was approved, not when intake or the
 * bump wrote the record.
 *
 * Usage: node scripts/approve.ts [--base <ref>]
 */
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { changedRecordIds, mergeBase, recordAt } from './lib/changes.ts'
import { loadRecords } from './lib/load.ts'
import { EXTENSIONS_DIR, fromRoot } from './lib/paths.ts'
import { approveRecord } from './lib/records.ts'

const { values } = parseArgs({ options: { base: { type: 'string' } } })

const base = mergeBase(values.base ?? 'origin/main')
const changed = changedRecordIds(base)
const now = new Date()

for (const { record, path } of loadRecords().filter(({ record }) => changed.has(record.id))) {
  const listed = recordAt(base, record.id) !== undefined
  writeFileSync(fromRoot(EXTENSIONS_DIR, path), `${JSON.stringify(approveRecord(record, listed, now), null, 2)}\n`)
  console.log(`approved ${record.id}${listed ? '' : ' (first version)'}`)
}
if (!changed.size) console.log('no changed records to approve')
