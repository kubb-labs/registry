import { fetchJson } from './http.ts'

type DownloadPeriod = 'last-week' | 'last-month' | 'last-year'

export async function fetchNpmDownloads({ pkg, period, scope }: { pkg: string; period: DownloadPeriod; scope: string }): Promise<number | undefined> {
  const data = await fetchJson<{ downloads?: number }>({ url: `https://api.npmjs.org/downloads/point/${period}/${pkg}`, scope })
  return data ? (data.downloads ?? 0) : undefined
}

/**
 * The version a package's `latest` dist-tag points at, or null when npm has no such package or
 * could not be reached.
 */
export async function fetchNpmLatest({ pkg, scope }: { pkg: string; scope: string }): Promise<string | null> {
  const data = await fetchJson<{ 'dist-tags'?: Record<string, string> }>({ url: `https://registry.npmjs.org/${pkg}`, scope })
  return data?.['dist-tags']?.latest ?? null
}
