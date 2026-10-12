import { fetchJson } from './http.ts'

type DownloadPeriod = 'last-week' | 'last-month' | 'last-year'

export async function fetchNpmDownloads({ pkg, period, scope }: { pkg: string; period: DownloadPeriod; scope: string }): Promise<number | undefined> {
  const data = await fetchJson<{ downloads?: number }>({ url: `https://api.npmjs.org/downloads/point/${period}/${pkg}`, scope })
  return data ? (data.downloads ?? 0) : undefined
}

/**
 * The published versions and dist-tags of a package, or null when npm has no such package or
 * could not be reached.
 */
export async function fetchNpmVersions({
  pkg,
  scope,
}: {
  pkg: string
  scope: string
}): Promise<{ versions: Array<string>; distTags: Record<string, string> } | null> {
  const data = await fetchJson<{ 'dist-tags'?: Record<string, string>; versions?: Record<string, unknown> }>({
    url: `https://registry.npmjs.org/${pkg}`,
    scope,
  })
  if (!data?.versions) return null
  return { versions: Object.keys(data.versions), distTags: data['dist-tags'] ?? {} }
}
