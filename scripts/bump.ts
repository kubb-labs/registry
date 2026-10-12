/**
 * Moves each record's pinned version to npm `latest` when that is newer, and stamps `reviewedAt`.
 * A version that fails validation (README.md) keeps the old pin and is reported instead.
 * When the new version ships its own OVERVIEW.md, the registry copy is removed. Never runs
 * extension code. Run weekly by .github/workflows/bump.yml.
 *
 * Writes a Markdown summary to the file in SUMMARY_FILE and sets the `count` output.
 */
import { rmSync, writeFileSync } from 'node:fs'
import { setOutput, writeMarkdown } from './lib/actions.ts'
import { checkArtifact } from './lib/check.ts'
import { loadRecords } from './lib/load.ts'
import { fetchNpmVersions } from './lib/npm.ts'
import { EXTENSIONS_DIR, fromRoot } from './lib/paths.ts'
import { bumpRecord } from './lib/records.ts'

const now = new Date()
const bumped: Array<string> = []
const skipped: Array<string> = []

for (const { record, path, registryOverview } of loadRecords()) {
  const npm = await fetchNpmVersions({ pkg: record.artifact.package, scope: 'bump' })
  const latest = npm?.distTags.latest
  if (!latest) {
    skipped.push(`- \`${record.id}\`: npm has no \`latest\` version`)
    continue
  }
  const next = bumpRecord(record, latest, now)
  if (!next) continue
  const { problems, authorOverview } = await checkArtifact(next, registryOverview, 'bump')
  if (problems.length) {
    skipped.push(`- \`${record.id}\`: ${latest} not pinned (${problems.join('; ').replaceAll('`', "'")})`)
    continue
  }
  writeFileSync(fromRoot(EXTENSIONS_DIR, path), `${JSON.stringify(next, null, 2)}\n`)
  const replacesOverview = authorOverview !== null && registryOverview !== null
  if (replacesOverview) rmSync(fromRoot(EXTENSIONS_DIR, path.replace(/\.json$/, '.md')))
  bumped.push(
    `- \`${record.id}\`: ${record.artifact.version} → ${latest}${replacesOverview ? ' (ships its own OVERVIEW.md, so the registry copy is removed)' : ''}`,
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
writeMarkdown('SUMMARY_FILE', summary)
setOutput('count', String(bumped.length))
