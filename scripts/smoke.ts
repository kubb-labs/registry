/**
 * Installs a record's pinned version with install scripts off, in a new temp folder, and runs the
 * load check. Run by the `smoke` job in .github/workflows/validate.yml, which has no token. It runs
 * the package, so it never runs where a token, a secret, or a shared cache can be reached.
 *
 * Builtins only, so the job needs no `pnpm install` and no dependency cache.
 *
 * Usage: node scripts/smoke.ts --id <owner>/<slug>
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { loadProblem } from './lib/smoke.ts'
import type { RegistryRecord } from './lib/types.ts'

// shortcut: repeats SLUG_PATTERN from lib/records.ts, which pulls in dependencies this job skips.
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/

const { id } = parseArgs({ options: { id: { type: 'string' } } }).values
if (!id || !ID_PATTERN.test(id)) throw new Error('Usage: node scripts/smoke.ts --id <owner>/<slug>')

const { artifact } = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'extensions', `${id}.json`), 'utf8')) as RegistryRecord
const spec =
  artifact.kind === 'npm'
    ? `${artifact.package}@${artifact.version}`
    : `https://codeload.github.com/${artifact.owner}/${artifact.repo}/tar.gz/${artifact.commit}`

const dir = mkdtempSync(join(tmpdir(), 'smoke-'))
writeFileSync(join(dir, 'package.json'), '{ "private": true }\n')
execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', spec], { cwd: dir, stdio: 'inherit' })

const manifestPath = join(dir, 'node_modules', artifact.package, 'kubb-extension.json')
// Official versions from before manifests have none. Validate reports a missing community manifest.
if (!existsSync(manifestPath)) {
  console.log(`${artifact.package}: no kubb-extension.json, skipped`)
  process.exit(0)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
// An entry file in the install dir, so the package resolves from its node_modules with ESM conditions.
const entry = join(dir, 'smoke-entry.mjs')
writeFileSync(entry, `export * from ${JSON.stringify(artifact.package)}\n`)
const mod = await import(pathToFileURL(entry).href)

const problem = loadProblem({ manifest, mod })
if (problem) {
  console.error(problem)
  process.exit(1)
}
console.log(`${artifact.package}: ${manifest.export}() loads as ${manifest.name}`)
