/**
 * Intake for a `submission` issue: resolves the submitted source to an npm version, or for a
 * package npm does not list, a GitHub release and its commit. Writes the record and checks the
 * pinned version. Run by .github/workflows/submit.yml, which opens the review pull request.
 * Artifact problems do not stop intake: they go in the pull request for the reviewer (REVIEW.md).
 *
 * Reads the issue from the environment, never from the command line: ISSUE_BODY and ISSUE_AUTHOR.
 * Writes the issue comment to COMMENT_FILE on failure, and the pull request body to PR_BODY_FILE.
 */
import { existsSync } from 'node:fs'
import { isPackageName } from '@kubb/core'
import { setOutput, writeMarkdown } from './lib/actions.ts'
import { writeRecord } from './lib/changes.ts'
import { artifactLabel, checkArtifact } from './lib/check.ts'
import { fetchLatestRelease, releaseOfTag, resolveTagCommit } from './lib/github.ts'
import { fetchJson } from './lib/http.ts'
import { parseCategories, parseIssueForm, parseSource, repositoryUrlFromNpm, type SubmissionSource } from './lib/issueForm.ts'
import { loadCategories } from './lib/load.ts'
import { fetchPackument, npmHasPackage } from './lib/npm.ts'
import { EXTENSIONS_DIR, fromRoot } from './lib/paths.ts'
import { parseRepositoryUrl, SLUG_PATTERN, slugFromPackage, toTimestamp, validateRecord } from './lib/records.ts'
import type { RegistryRecord } from './lib/types.ts'

const SCOPE = 'submit'
const REVIEW_URL = 'https://github.com/kubb-labs/registry/blob/main/REVIEW.md'

function fail(message: string): never {
  writeMarkdown({ envName: 'COMMENT_FILE', markdown: `${message}\n\nEdit this issue and intake will run again.\n` })
  console.error(message)
  process.exit(1)
}

type Resolved = Pick<RegistryRecord, 'artifact'> & { repositoryUrl: string }

/**
 * An npm version and its repository: `version` or npm `latest`, and the repository the package
 * metadata names unless the source already gave one.
 */
async function resolveNpm({ pkg, version: wanted, repositoryUrl }: { pkg: string; version?: string; repositoryUrl?: string }): Promise<Resolved> {
  const packument = await fetchPackument({ pkg, scope: SCOPE })
  if (!packument?.versions) fail('The npm package does not exist, or npm could not be reached.')
  const version = wanted ?? packument['dist-tags']?.latest
  if (!version || !packument.versions[version]) fail(wanted ? 'That version is not published on npm.' : 'The package has no `latest` version on npm.')
  const url = repositoryUrl ?? repositoryUrlFromNpm(packument.versions[version]!.repository)
  if (!url) fail('The npm package does not name a GitHub repository in its `package.json`. Submit the GitHub URL as the source instead.')
  return { artifact: { kind: 'npm', package: pkg, version }, repositoryUrl: url }
}

/**
 * A GitHub source names its package in the `package.json` of the submitted folder. A package npm
 * lists resolves to its npm version. Any other package installs from GitHub: from the release tag in
 * the URL, else the latest release, at the repository root.
 */
async function resolveGitHub(source: Extract<SubmissionSource, { kind: 'github' }>): Promise<Resolved> {
  const { owner, repo, path } = source
  const ref = source.ref ?? 'HEAD'
  const packageJson = await fetchJson<{ name?: unknown; private?: unknown }>({
    url: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path ? `${path}/` : ''}package.json`,
    scope: SCOPE,
  })
  if (!isPackageName(packageJson?.name)) fail('The GitHub source has no `package.json` with a valid package name in that folder.')
  const pkg = packageJson.name

  const onNpm = await npmHasPackage({ pkg, scope: SCOPE })
  if (onNpm === null) fail('npm could not be reached to check whether it lists the package.')
  if (onNpm) {
    if (packageJson.private === true) fail('The `package.json` at the GitHub source is private, so the package on npm with that name is not this one.')
    return resolveNpm({ pkg, repositoryUrl: `https://github.com/${owner}/${repo}${path ? `/tree/${ref}/${path}` : ''}` })
  }

  if (path)
    fail(
      'The package is not on npm, so it installs from GitHub, which needs it at the repository root. Publish it to npm, or submit a repository that holds it at its root.',
    )
  const release = releaseOfTag(source.ref) ?? (await fetchLatestRelease({ owner, repo, scope: SCOPE }))
  if (!release) fail('The package is not on npm, and the repository has no GitHub release with a semver tag such as `v1.2.0`. Create one.')
  const commit = await resolveTagCommit({ owner, repo, tag: release.tag, scope: SCOPE })
  if (!commit) fail('The release tag could not be read from the repository.')
  return {
    artifact: { kind: 'github', package: pkg, version: release.version, owner, repo, tag: release.tag, commit },
    repositoryUrl: `https://github.com/${owner}/${repo}`,
  }
}

const author = process.env.ISSUE_AUTHOR ?? ''

const fields = parseIssueForm(process.env.ISSUE_BODY ?? '')
const parsed = parseSource(fields.Source ?? '')
if ('error' in parsed) fail(parsed.error)
const { source } = parsed
const { artifact, repositoryUrl } = source.kind === 'npm' ? await resolveNpm({ pkg: source.package, version: source.version }) : await resolveGitHub(source)
const owner = parseRepositoryUrl(repositoryUrl)!.owner
const slug = slugFromPackage(artifact.package)
if (!SLUG_PATTERN.test(owner) || !SLUG_PATTERN.test(slug))
  fail('The repository owner or the package name cannot form a registry id: both must be lowercase letters and digits joined by single hyphens.')

const id = `${owner}/${slug}`
const relativePath = `${id}.json`
if (existsSync(fromRoot(EXTENSIONS_DIR, relativePath))) fail(`\`${id}\` is already in the registry. The weekly bump moves its pin to each new version.`)

const categoryList = loadCategories()
const categories = parseCategories({ input: fields.Categories ?? '', categories: categoryList })
const now = toTimestamp(new Date())
const record: RegistryRecord = {
  $schema: 'https://kubb.dev/schemas/registry-record.json',
  id,
  artifact,
  repository: { url: repositoryUrl },
  submittedAt: now,
  submittedBy: author,
  publishedAt: now,
  reviewedAt: now,
  ...(categories.length ? { categories } : {}),
}
const recordErrors = validateRecord({ record, relativePath, knownCategories: new Set(categoryList.map((category) => category.slug)) })
if (recordErrors.length) fail(`The record could not be written:\n\n${recordErrors.map((error) => `- ${error}`).join('\n')}`)

writeRecord({ path: relativePath, record })
console.log(`wrote ${EXTENSIONS_DIR}/${relativePath}`)

// Problems reach the reviewer in the pull request. Text from the package stays inside a code block.
const { problems } = await checkArtifact({ record, registryOverview: null, scope: SCOPE })
const checks = problems.length
  ? `<details><summary>Validation found problems for the reviewer</summary>

\`\`\`text
${problems.map((problem) => problem.replaceAll('`', "'")).join('\n')}
\`\`\`

</details>`
  : 'Validation passed: the manifest and the docs at this version are valid.'
writeMarkdown({
  envName: 'PR_BODY_FILE',
  markdown: `Adds \`${artifactLabel(artifact)}\`${artifact.kind === 'github' ? ` (commit \`${artifact.commit}\`, installed from GitHub)` : ''} to the extension registry as \`${id}\`. Submitted by @${author}.

${categories.length ? `Categories: ${categories.map((category) => `\`${category}\``).join(', ')}.` : 'No categories were ticked. The reviewer adds them.'}

${checks}

Review it against [REVIEW.md](${REVIEW_URL}) before merging, including the options page and the guides in \`docs/\`. Without a \`docs/overview.md\` in the package, the reviewer writes \`${EXTENSIONS_DIR}/${id}.md\`.
`,
})

setOutput({ name: 'id', value: id })
