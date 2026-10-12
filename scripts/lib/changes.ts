import { execFileSync } from 'node:child_process'
import { EXTENSIONS_DIR, fromRoot } from './paths.ts'

const git = (args: Array<string>) => execFileSync('git', args, { cwd: fromRoot(), encoding: 'utf8' }).trim()

/**
 * The merge base of `base` and `HEAD`, which `--changed` compares against.
 */
export function mergeBase(base: string): string {
  return git(['merge-base', base, 'HEAD'])
}

/**
 * Record ids whose `.json` or `.md` changed between `commit` and `HEAD`.
 */
export function changedRecordIds(commit: string): Set<string> {
  const changed = git(['diff', '--name-only', '--relative', `${commit}...HEAD`, '--', EXTENSIONS_DIR])
  return new Set(
    changed
      .split('\n')
      .filter(Boolean)
      .flatMap((path) => path.match(new RegExp(`^${EXTENSIONS_DIR}/([^/]+/[^/]+)\\.(?:json|md)$`))?.[1] ?? []),
  )
}

/**
 * The record as listed at `commit`, or `undefined` when it is new.
 */
export function recordAt(commit: string, id: string): Record<string, unknown> | undefined {
  const path = `${EXTENSIONS_DIR}/${id}.json`
  if (!git(['ls-tree', '--name-only', commit, '--', path])) return undefined
  return JSON.parse(git(['show', `${commit}:./${path}`])) as Record<string, unknown>
}
