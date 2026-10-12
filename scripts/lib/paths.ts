import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')

/** Reviewed records, one per `<owner>/<slug>.json`, with an optional `<owner>/<slug>.md` overview. */
export const EXTENSIONS_DIR = 'extensions'

export function fromRoot(...segments: Array<string>): string {
  return resolve(ROOT, ...segments)
}

export function log({ scope, message }: { scope: string; message: string }): void {
  console.log(`[${scope}] ${message}`)
}

export function warn({ scope, message }: { scope: string; message: string }): void {
  console.warn(`[${scope}] ⚠ ${message}`)
}
