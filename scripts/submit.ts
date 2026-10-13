/**
 * Intake for a `submission` issue: resolves the submitted source to an npm package and
 * version, writes the record, and checks the pinned version. Run by
 * .github/workflows/submit.yml, which opens the review pull request. Artifact problems
 * do not stop intake: they go in the pull request for the reviewer (REVIEW.md).
 *
 * Reads the issue from the environment, never from the command line: ISSUE_BODY and ISSUE_AUTHOR.
 * Writes the issue comment to COMMENT_FILE on failure, and the pull request body to PR_BODY_FILE.
 */
import { existsSync } from 'node:fs'
import { setOutput, writeMarkdown } from './lib/actions.ts'
import { writeRecord } from './lib/changes.ts'
import { checkArtifact } from './lib/check.ts'
import { fetchJson } from './lib/http.ts'
import { PACKAGE_PATTERN, parseCategories, parseIssueForm, parseSource, repositoryUrlFromNpm, type SubmissionSource } from './lib/issueForm.ts'
import { loadCategories } from './lib/load.ts'
import { EXTENSIONS_DIR, fromRoot } from './lib/paths.ts'
import { parseRepositoryUrl, SLUG_PATTERN, slugFromPackage, toTimestamp, validateRecord } from './lib/records.ts'
import type { RegistryRecord } from './lib/types.ts'

const SCOPE = 'submit'
const REVIEW_URL = 'https://github.com/kubb-labs/registry/blob/main/REVIEW.md'
const GITHUB_USER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/

function fail(message: string): never {
  writeMarkdown({ envName: 'COMMENT_FILE', markdown: `${message}\n\nEdit this issue and intake will run again.\n` })
  console.error(message)
  process.exit(1)
}

type Packument = { 'dist-tags'?: Record<string, string>; versions?: Record<string, { repository?: unknown }> }

/**
 * The npm package and the GitHub repository a source points at. A GitHub source names its package
 * in the `package.json` of the submitted folder; an npm source names its repository in package metadata.
 */
async function resolveSource(source: SubmissionSource): Promise<{ pkg: string; version?: string; repositoryUrl: string | null }> {
  if (source.kind === 'npm') return { pkg: source.package, version: source.version, repositoryUrl: null }
  const ref = source.ref ?? 'HEAD'
  const packageJson = await fetchJson<{ name?: unknown; private?: unknown }>({
    url: `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${ref}/${source.path ? `${source.path}/` : ''}package.json`,
    scope: SCOPE,
  })
  if (typeof packageJson?.name !== 'string' || !PACKAGE_PATTERN.test(packageJson.name))
    fail('The GitHub source has no `package.json` with a valid npm package name in that folder.')
  if (packageJson.private === true) fail('The `package.json` at the GitHub source is private, so it is not on npm.')
  return { pkg: packageJson.name, repositoryUrl: `https://github.com/${source.owner}/${source.repo}${source.path ? `/tree/${ref}/${source.path}` : ''}` }
}

const author = process.env.ISSUE_AUTHOR ?? ''
if (!GITHUB_USER_PATTERN.test(author)) fail('The issue author is not a valid GitHub username.')

const fields = parseIssueForm(process.env.ISSUE_BODY ?? '')
const parsed = parseSource(fields.Source ?? '')
if ('error' in parsed) fail(parsed.error)
const resolved = await resolveSource(parsed.source)

const packument = await fetchJson<Packument>({ url: `https://registry.npmjs.org/${resolved.pkg}`, scope: SCOPE })
if (!packument?.versions) fail('The npm package does not exist, or npm could not be reached.')
const version = resolved.version ?? packument['dist-tags']?.latest
if (!version || !packument.versions[version]) fail(resolved.version ? 'That version is not published on npm.' : 'The package has no `latest` version on npm.')

const repositoryUrl = resolved.repositoryUrl ?? repositoryUrlFromNpm(packument.versions[version]!.repository)
if (!repositoryUrl) fail('The npm package does not name a GitHub repository in its `package.json`. Submit the GitHub URL as the source instead.')
const owner = parseRepositoryUrl(repositoryUrl)!.owner
const slug = slugFromPackage(resolved.pkg)
if (!SLUG_PATTERN.test(owner) || !SLUG_PATTERN.test(slug))
  fail('The repository owner or the package name cannot form a registry id: both must be lowercase letters and digits joined by single hyphens.')

const id = `${owner}/${slug}`
const relativePath = `${id}.json`
if (existsSync(fromRoot(EXTENSIONS_DIR, relativePath)))
  fail(`\`${id}\` is already in the registry. Its pinned version moves to npm \`latest\` through the weekly bump.`)

const categoryList = loadCategories()
const categories = parseCategories({ input: fields.Categories ?? '', categories: categoryList })
const now = toTimestamp(new Date())
const record: RegistryRecord = {
  $schema: 'https://kubb.dev/schemas/registry-record.json',
  id,
  artifact: { kind: 'npm', package: resolved.pkg, version },
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
  : 'Validation passed: the manifest and the overview at this version are valid.'
writeMarkdown({
  envName: 'PR_BODY_FILE',
  markdown: `Adds \`${resolved.pkg}@${version}\` to the extension registry as \`${id}\`. Submitted by @${author}.

${categories.length ? `Categories: ${categories.map((category) => `\`${category}\``).join(', ')}.` : 'No categories were ticked. The reviewer adds them.'}

${checks}

Review it against [REVIEW.md](${REVIEW_URL}) before merging. Without an \`OVERVIEW.md\` in the package, the reviewer writes \`${EXTENSIONS_DIR}/${id}.md\`.
`,
})

setOutput({ name: 'id', value: id })
