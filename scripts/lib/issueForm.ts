/**
 * Parses the body GitHub renders for the submission issue form
 * (.github/ISSUE_TEMPLATE/submit-extension.yml). The body is untrusted input: every field is
 * checked against a strict pattern before anything uses it, and errors never echo it back.
 */
import type { RegistryCategory } from './types.ts'

/** What GitHub writes for an optional field left empty. */
const NO_RESPONSE = '_No response_'

const PACKAGE_NAME = '(?:@[a-z0-9][a-z0-9._~-]*/)?[a-z0-9][a-z0-9._~-]*'
const VERSION = '\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?'
/** A valid npm package name, without the 214-character limit. */
export const PACKAGE_PATTERN = new RegExp(`^${PACKAGE_NAME}$`)
const NPM_SOURCE = new RegExp(`^(?:npm:)?(${PACKAGE_NAME})(?:@(${VERSION}))?$`)
const NPM_PAGE = new RegExp(`^https://(?:www\\.)?npmjs\\.com/package/(${PACKAGE_NAME})(?:/v/(${VERSION}))?/?$`)
const GITHUB_SOURCE = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?(?:\/tree\/([A-Za-z0-9._-]+)((?:\/[A-Za-z0-9._@-]+)*))?\/?$/

/**
 * Where a submitted extension lives: an npm package (optionally an exact version), or a GitHub
 * repository or a folder inside one, whose `package.json` names the package.
 */
export type SubmissionSource = { kind: 'npm'; package: string; version?: string } | { kind: 'github'; owner: string; repo: string; ref?: string; path?: string }

/**
 * Splits an issue form body into its fields, keyed by the `### <label>` heading GitHub renders for
 * each field. An empty optional field reads as ''.
 */
export function parseIssueForm(body: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const section of body.replaceAll('\r\n', '\n').split(/^### /m).slice(1)) {
    const [label = '', ...lines] = section.split('\n')
    const value = lines.join('\n').trim()
    fields[label.trim()] = value === NO_RESPONSE ? '' : value
  }
  return fields
}

/**
 * Reads the Source field: an npm package name (`@acme/kubb-plugin-x`, `@acme/kubb-plugin-x@1.2.3`,
 * `npm:...`), an npmjs.com package page, or a GitHub repository or folder URL.
 */
export function parseSource(input: string): { source: SubmissionSource } | { error: string } {
  const text = input.trim()
  const npm = text.match(NPM_SOURCE) ?? text.match(NPM_PAGE)
  if (npm && npm[1]!.length <= 214) return { source: { kind: 'npm', package: npm[1]!, ...(npm[2] ? { version: npm[2] } : {}) } }

  const github = text.match(GITHUB_SOURCE)
  if (github) {
    const path = github[4]?.slice(1)
    if (path?.split('/').some((segment) => segment === '.' || segment === '..'))
      return { error: 'The folder in the GitHub URL must stay inside the repository.' }
    return {
      source: { kind: 'github', owner: github[1]!.toLowerCase(), repo: github[2]!, ...(github[3] ? { ref: github[3] } : {}), ...(path ? { path } : {}) },
    }
  }
  return {
    error:
      'The source is not an npm package name or a GitHub repository URL, such as `@acme/kubb-plugin-graphql` or `https://github.com/acme/kubb-plugins/tree/main/packages/graphql`.',
  }
}

/**
 * Reads the ticked categories, in the order the form lists them, so the first tick is the main one.
 * Labels that are not in `categories.json` are ignored.
 */
export function parseCategories({ input, categories }: { input: string; categories: Array<RegistryCategory> }): Array<string> {
  const ticked = new Set(
    input
      .split('\n')
      .flatMap((line) => line.match(/^\s*-\s*\[[xX]\]\s+(.+?)\s*$/)?.[1] ?? [])
      .map((label) => label.toLowerCase()),
  )
  return categories.filter((category) => ticked.has(category.label.toLowerCase())).map((category) => category.slug)
}

/**
 * The GitHub repository URL a source or an npm `repository` field points at, or null when it is
 * not on GitHub. Accepts `git+https://github.com/o/r.git`, `github:o/r`, and `o/r` shorthand.
 */
export function repositoryUrlFromNpm(repository: unknown): string | null {
  const url = typeof repository === 'string' ? repository : (repository as { url?: unknown } | null)?.url
  const directory = (repository as { directory?: unknown } | null)?.directory
  if (typeof url !== 'string') return null
  const match =
    url.match(/^(?:git\+)?(?:https|ssh|git):\/\/(?:git@)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/) ??
    url.match(/^(?:github:)?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?$/)
  if (!match) return null
  const folder =
    typeof directory === 'string' && /^[A-Za-z0-9._@-]+(?:\/[A-Za-z0-9._@-]+)*$/.test(directory) && !directory.split('/').includes('..') ? directory : undefined
  return `https://github.com/${match[1]}/${match[2]}${folder ? `/tree/HEAD/${folder}` : ''}`
}
