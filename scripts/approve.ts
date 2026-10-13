/**
 * Stamps the records a pull request adds or changes as approved now: `reviewedAt` on every one,
 * and `publishedAt` on new ones. The reviewer runs it on the pull request branch right before
 * merging (REVIEW.md), so the dates say when the version was approved, not when intake or the
 * bump wrote the record.
 *
 * Usage: node scripts/approve.ts [--base <ref>]
 */
import { parseArgs } from 'node:util'
import { changedRecords, recordAt, writeRecord } from './lib/changes.ts'
import { loadRecords } from './lib/load.ts'
import { approveRecord } from './lib/records.ts'

const { values } = parseArgs({ options: { base: { type: 'string' } } })
const { base, ids } = changedRecords(values.base)
const now = new Date()

for (const { record, path } of loadRecords().filter(({ record }) => ids.has(record.id))) {
  const listed = recordAt({ commit: base, id: record.id }) !== undefined
  writeRecord({ path, record: approveRecord({ record, listed, now }) })
  console.log(`approved ${record.id}${listed ? '' : ' (first version)'}`)
}
if (!ids.size) console.log('no changed records to approve')
