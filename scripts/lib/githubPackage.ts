/**
 * Checks the root `package.json` of a GitHub release against what an install from its commit needs:
 * the name and version match the record, nothing builds or runs at install, and the committed build
 * is what gets installed. Pure: the caller reads the files.
 */
import { matchesGlob } from 'node:path'
import type { GitHubArtifact } from './types.ts'

/**
 * Scripts that make npm or pnpm prepare a Git dependency, which installs its dev dependencies and
 * runs its build on the user's machine (pnpm refuses by default).
 */
const PREPARE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'prepublish', 'publish', 'build']

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Every file `main`, `module`, and `exports` point to, relative to the package root. Wildcard
 * targets are left out, since they name no single file.
 */
export function entryTargets(packageJson: Record<string, unknown>): Array<string> {
  const strings = (value: unknown): Array<string> => {
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value.flatMap(strings)
    return isObject(value) ? Object.values(value).flatMap(strings) : []
  }
  const targets = [packageJson.main, packageJson.module, packageJson.exports].flatMap(strings)
  return [...new Set(targets.filter((target) => !target.includes('*')).map((target) => target.replace(/^\.\//, '')))]
}

/**
 * Whether the `files` list of `package.json` includes `path`: an exact entry, a folder above it, or
 * a glob that matches it.
 */
function isListed({ files, path }: { files: Array<string>; path: string }): boolean {
  return files.some((entry) => {
    const clean = entry.replace(/^\.?\//, '').replace(/\/+$/, '')
    return clean === path || path.startsWith(`${clean}/`) || (/[*?[{]/.test(clean) && matchesGlob(path, clean))
  })
}

/**
 * The problems with a release's root `package.json`. `paths` holds every file at the commit, and
 * `manifest` whether the commit has a `kubb-extension.json`, which the install must ship.
 */
export function githubPackageProblems({
  artifact,
  text,
  paths,
  manifest,
}: {
  artifact: GitHubArtifact
  text: string | undefined
  paths: ReadonlySet<string>
  manifest: boolean
}): Array<string> {
  if (text === undefined) return ['the repository root has no package.json']
  let packageJson: unknown
  try {
    packageJson = JSON.parse(text)
  } catch {
    return ['package.json is not valid JSON']
  }
  if (!isObject(packageJson)) return ['package.json is not an object']

  const problems: Array<string> = []
  if (packageJson.name !== artifact.package) problems.push(`package.json names ${JSON.stringify(packageJson.name)}, not "${artifact.package}"`)
  if (packageJson.version !== artifact.version)
    problems.push(`package.json has version ${JSON.stringify(packageJson.version)}, not "${artifact.version}" from tag ${artifact.tag}`)

  const scripts = isObject(packageJson.scripts) ? Object.keys(packageJson.scripts).filter((name) => PREPARE_SCRIPTS.includes(name)) : []
  if (scripts.length)
    problems.push(
      `package.json has the ${scripts.join(', ')} script(s), which make package managers build the package at install. Commit the build and rename or remove them.`,
    )
  if (packageJson.workspaces !== undefined) problems.push('package.json has "workspaces", which makes npm install the whole workspace at install')

  const targets = entryTargets(packageJson)
  if (!targets.length) problems.push('package.json names no file in "main", "module", or "exports"')
  const outside = targets.filter((target) => target.split('/').includes('..'))
  if (outside.length) problems.push(`entry points outside the package: ${outside.join(', ')}`)
  const missing = targets.filter((target) => !outside.includes(target) && !paths.has(target))
  if (missing.length) problems.push(`entry points not committed: ${missing.join(', ')}`)

  const { files } = packageJson
  if (!Array.isArray(files) || !files.every((entry) => typeof entry === 'string')) {
    problems.push('package.json has no "files" list. Without one, package managers apply .gitignore and can leave out the committed build.')
    return problems
  }
  // npm packs package.json whatever `files` says.
  const unlisted = [...(manifest ? ['kubb-extension.json'] : []), ...targets].filter((path) => path !== 'package.json' && !isListed({ files, path }))
  if (unlisted.length) problems.push(`"files" in package.json leaves out ${unlisted.join(', ')}`)
  return problems
}
