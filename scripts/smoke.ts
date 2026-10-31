/**
 * Installs a record's pinned version with install scripts off and runs the load check. Run by
 * .github/workflows/smoke.yml in a job with no token. It runs the package, so it never runs
 * where a token, a secret, or a shared cache can be reached.
 *
 * Builtins only, so the job needs no `pnpm install` and no dependency cache.
 *
 * Usage: node scripts/smoke.ts --id <owner>/<slug> --dir <empty install dir>
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { loadProblems } from './lib/smoke.ts'
import type { RegistryRecord } from './lib/types.ts'

// shortcut: repeats SLUG_PATTERN from lib/records.ts, which pulls in dependencies this job skips.
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/

const { values } = parseArgs({ options: { id: { type: 'string' }, dir: { type: 'string' } } })
const { id, dir } = values
if (!id || !ID_PATTERN.test(id) || !dir) throw new Error('Usage: node scripts/smoke.ts --id <owner>/<slug> --dir <empty install dir>')

const { artifact } = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'extensions', `${id}.json`), 'utf8')) as RegistryRecord
const spec =
  artifact.kind === 'npm'
    ? `${artifact.package}@${artifact.version}`
    : `https://codeload.github.com/${artifact.owner}/${artifact.repo}/tar.gz/${artifact.commit}`

writeFileSync(join(dir, 'package.json'), '{ "private": true }\n')
execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', spec], { cwd: dir, stdio: 'inherit' })

const manifest = JSON.parse(readFileSync(join(dir, 'node_modules', artifact.package, 'kubb-extension.json'), 'utf8'))
// An entry file in the install dir, so the package resolves from its node_modules with ESM conditions.
const entry = join(dir, 'smoke-entry.mjs')
writeFileSync(entry, `export * from ${JSON.stringify(artifact.package)}\n`)
const mod = await import(pathToFileURL(entry).href)

const problems = loadProblems({ manifest, mod })
if (problems.length) {
  for (const problem of problems) console.error(problem)
  process.exit(1)
}
console.log(`${artifact.package}: ${manifest.export}() loads as ${manifest.name}`)
