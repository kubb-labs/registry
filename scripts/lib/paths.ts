import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')

/** Reviewed records, one per `<owner>/<slug>.json`, with an optional `<owner>/<slug>.md` overview. */
export const EXTENSIONS_DIR = 'extensions'

/** The static protocol `pnpm build` writes, which GitHub Pages serves and the npm package ships. */
export const DIST_DIR = 'dist'

export function fromRoot(...segments: Array<string>): string {
  return resolve(ROOT, ...segments)
}

export function log(scope: string, message: string): void {
  console.log(`[${scope}] ${message}`)
}

export function warn(scope: string, message: string): void {
  console.warn(`[${scope}] ⚠ ${message}`)
}
