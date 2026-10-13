import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { EXTENSIONS_DIR, fromRoot } from './paths.ts'
import type { RegistryRecord } from './types.ts'

const git = (args: Array<string>) => execFileSync('git', args, { cwd: fromRoot(), encoding: 'utf8' }).trim()

/**
 * The merge base of `ref` and `HEAD`, and the ids of the records whose `.json` or `.md` changed since it.
 */
export function changedRecords(ref = 'origin/main'): { base: string; ids: Set<string> } {
  const base = git(['merge-base', ref, 'HEAD'])
  const paths = git(['diff', '--name-only', '--relative', `${base}...HEAD`, '--', EXTENSIONS_DIR]).split('\n')
  const pattern = new RegExp(`^${EXTENSIONS_DIR}/([^/]+/[^/]+)\\.(?:json|md)$`)
  return { base, ids: new Set(paths.flatMap((path) => path.match(pattern)?.[1] ?? [])) }
}

/**
 * The record as listed at `commit`, or `undefined` when it is new.
 */
export function recordAt({ commit, id }: { commit: string; id: string }): Record<string, unknown> | undefined {
  const path = `${EXTENSIONS_DIR}/${id}.json`
  if (!git(['ls-tree', '--name-only', commit, '--', path])) return undefined
  return JSON.parse(git(['show', `${commit}:./${path}`])) as Record<string, unknown>
}

/**
 * Writes a record to `extensions/<path>` in the layout every script uses.
 */
export function writeRecord({ path, record }: { path: string; record: RegistryRecord }): void {
  const file = fromRoot(EXTENSIONS_DIR, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
}
