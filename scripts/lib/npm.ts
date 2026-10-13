import { fetchJson } from './http.ts'

/** The parts of a package's npm document the scripts read. */
export type Packument = {
  'dist-tags'?: Record<string, string>
  versions?: Record<string, { dist?: { tarball?: string; integrity?: string }; repository?: unknown }>
}

/** A package's npm document, or null when npm has no such package or could not be reached. */
export function fetchPackument({ pkg, scope }: { pkg: string; scope: string }): Promise<Packument | null> {
  return fetchJson<Packument>({ url: `https://registry.npmjs.org/${pkg}`, scope })
}

/**
 * The version a package's `latest` dist-tag points at, or null when npm has no such package or
 * could not be reached.
 */
export async function fetchNpmLatest({ pkg, scope }: { pkg: string; scope: string }): Promise<string | null> {
  return (await fetchPackument({ pkg, scope }))?.['dist-tags']?.latest ?? null
}

/**
 * Whether npm lists `pkg`, or null when npm cannot be reached, so an outage never reads as "not on npm".
 */
export async function npmHasPackage({ pkg, scope }: { pkg: string; scope: string }): Promise<boolean | null> {
  const response = await fetch(`https://registry.npmjs.org/${pkg}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)
  await response?.body?.cancel()
  if (response?.status === 404) return false
  if (response?.ok) return true
  console.warn(`[${scope}] ⚠ could not check whether npm lists ${pkg}`)
  return null
}
