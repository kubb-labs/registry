import { fetchJson } from './http.ts'

const GITHUB_API = 'https://api.github.com'

const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'kubb-labs-registry',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
}

/**
 * The star count of a GitHub repository (`<owner>/<repo>`), or undefined when GitHub cannot be read.
 */
export async function fetchRepoStars({ slug, scope }: { slug: string; scope: string }): Promise<number | undefined> {
  const data = await fetchJson<{ stargazers_count?: number }>({ url: `${GITHUB_API}/repos/${slug}`, headers, scope })
  return data ? (data.stargazers_count ?? 0) : undefined
}
