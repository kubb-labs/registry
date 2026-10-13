import { fetchJson } from './http.ts'

/**
 * The version a package's `latest` dist-tag points at, or null when npm has no such package or
 * could not be reached.
 */
export async function fetchNpmLatest({ pkg, scope }: { pkg: string; scope: string }): Promise<string | null> {
  const data = await fetchJson<{ 'dist-tags'?: Record<string, string> }>({ url: `https://registry.npmjs.org/${pkg}`, scope })
  return data?.['dist-tags']?.latest ?? null
}
