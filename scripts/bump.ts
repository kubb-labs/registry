/**
 * Moves each record's pinned version to npm `latest`, or to the latest GitHub release and its commit,
 * when that is newer, and stamps `reviewedAt`.
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
import { fetchLatestRelease, resolveTagCommit } from './lib/github.ts'
import { fetchNpmLatest } from './lib/npm.ts'
import { EXTENSIONS_DIR, fromRoot } from './lib/paths.ts'
import { bumpRecord } from './lib/records.ts'
import type { GitHubArtifact, RegistryRecord } from './lib/types.ts'

const SCOPE = 'bump'
const now = new Date()
const bumped: Array<string> = []
const skipped: Array<string> = []

type Latest = { version: string; pin?: Pick<GitHubArtifact, 'tag' | 'commit'> } | { problem: string }

/**
 * The newest version a record can move to: npm `latest`, or the latest GitHub release with its tag
 * and commit. Gives the reason when there is none.
 */
async function findLatest({ artifact }: RegistryRecord): Promise<Latest> {
  if (artifact.kind === 'npm') {
    const version = await fetchNpmLatest({ pkg: artifact.package, scope: SCOPE })
    return version ? { version } : { problem: 'npm has no `latest` version' }
  }
  const release = await fetchLatestRelease({ ...artifact, scope: SCOPE })
  if (!release) return { problem: 'GitHub has no latest release with a semver tag' }
  const commit = await resolveTagCommit({ ...artifact, tag: release.tag, scope: SCOPE })
  return commit ? { version: release.version, pin: { tag: release.tag, commit } } : { problem: `the tag of release ${release.version} could not be read` }
}

for (const { record, path, registryOverview } of loadRecords()) {
  const latest = await findLatest(record)
  if ('problem' in latest) {
    skipped.push(`- \`${record.id}\`: ${latest.problem}`)
    continue
  }
  const next = bumpRecord({ record, latest: latest.version, pin: latest.pin, now })
  if (!next) continue
  const { problems, authorOverview } = await checkArtifact({ record: next, registryOverview, scope: SCOPE })
  if (problems.length) {
    skipped.push(`- \`${record.id}\`: ${latest.version} not pinned (${problems.join('; ').replaceAll('`', "'")})`)
    continue
  }
  writeRecord({ path, record: next })
  const replacesOverview = authorOverview !== null && registryOverview !== null
  if (replacesOverview) rmSync(fromRoot(EXTENSIONS_DIR, path.replace(/\.json$/, '.md')))
  bumped.push(
    `- \`${record.id}\`: ${record.artifact.version} → ${latest.version}${replacesOverview ? ' (ships its own overview, so the registry copy is removed)' : ''}`,
  )
}

const summary = [
  'Moves registry pins to the npm `latest` version or the latest GitHub release. Review each new version against [REVIEW.md](https://github.com/kubb-labs/registry/blob/main/REVIEW.md) before merging.',
  '',
  bumped.length ? '### Bumped' : 'No record needs a bump.',
  ...bumped,
  ...(skipped.length ? ['', '### Not bumped', ...skipped] : []),
  '',
].join('\n')
writeMarkdown({ envName: 'SUMMARY_FILE', markdown: summary })
setOutput({ name: 'count', value: String(bumped.length) })
