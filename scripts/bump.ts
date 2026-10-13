/**
 * Moves each record's pinned version to npm `latest` when that is newer, and stamps `reviewedAt`.
 * A version that fails validation (README.md) keeps the old pin and is reported instead.
 * When the new version ships its own overview (`docs/overview.md`, or a root `OVERVIEW.md`), the
 * registry copy is removed. Never runs extension code. Run weekly by .github/workflows/bump.yml.
 *
 * Writes a Markdown summary to the file in SUMMARY_FILE and sets the `count` output.
 */
import { rmSync } from 'node:fs'
import { setOutput, writeMarkdown } from './lib/actions.ts'
import { writeRecord } from './lib/changes.ts'
import { checkArtifact } from './lib/check.ts'
import { loadRecords } from './lib/load.ts'
import { fetchNpmLatest } from './lib/npm.ts'
import { EXTENSIONS_DIR, fromRoot } from './lib/paths.ts'
import { bumpRecord } from './lib/records.ts'

const now = new Date()
const bumped: Array<string> = []
const skipped: Array<string> = []

for (const { record, path, registryOverview } of loadRecords()) {
  const latest = await fetchNpmLatest({ pkg: record.artifact.package, scope: 'bump' })
  if (!latest) {
    skipped.push(`- \`${record.id}\`: npm has no \`latest\` version`)
    continue
  }
  const next = bumpRecord({ record, latest, now })
  if (!next) continue
  const { problems, authorOverview } = await checkArtifact({ record: next, registryOverview, scope: 'bump' })
  if (problems.length) {
    skipped.push(`- \`${record.id}\`: ${latest} not pinned (${problems.join('; ').replaceAll('`', "'")})`)
    continue
  }
  writeRecord({ path, record: next })
  const replacesOverview = authorOverview !== null && registryOverview !== null
  if (replacesOverview) rmSync(fromRoot(EXTENSIONS_DIR, path.replace(/\.json$/, '.md')))
  bumped.push(
    `- \`${record.id}\`: ${record.artifact.version} → ${latest}${replacesOverview ? ' (ships its own overview, so the registry copy is removed)' : ''}`,
  )
}

const summary = [
  'Moves registry pins to the npm `latest` version. Review each new version against [REVIEW.md](https://github.com/kubb-labs/registry/blob/main/REVIEW.md) before merging.',
  '',
  bumped.length ? '### Bumped' : 'No record needs a bump.',
  ...bumped,
  ...(skipped.length ? ['', '### Not bumped', ...skipped] : []),
  '',
].join('\n')
writeMarkdown({ envName: 'SUMMARY_FILE', markdown: summary })
setOutput({ name: 'count', value: String(bumped.length) })
