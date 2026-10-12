import { warn } from './paths.ts'

const RETRIES = 2
const RETRY_DELAY_MS = 250

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

/**
 * `fetch` with a timeout and two retries on network errors and 5xx answers. Throws on any other
 * non-2xx answer.
 */
async function request(url: string, { headers, timeout = 10_000 }: { headers?: Record<string, string>; timeout?: number } = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const last = attempt >= RETRIES
    let response: Response
    try {
      response = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) })
    } catch (err) {
      if (last) throw err
      await sleep(RETRY_DELAY_MS * (attempt + 1))
      continue
    }
    if (response.ok) return response
    if (response.status < 500 || last) throw new Error(`${url} answered ${response.status}`)
    await sleep(RETRY_DELAY_MS * (attempt + 1))
  }
}

/**
 * The JSON at `url`, or null after a warning when it cannot be read.
 */
export async function fetchJson<T>({ url, headers, scope = 'http' }: { url: string; headers?: Record<string, string>; scope?: string }): Promise<T | null> {
  try {
    return (await (await request(url, { headers })).json()) as T
  } catch (err) {
    warn(scope, (err as Error).message)
    return null
  }
}

/**
 * The bytes at `url`. Throws when they cannot be read.
 */
export async function fetchBytes(url: string, { timeout }: { timeout?: number } = {}): Promise<Uint8Array> {
  return new Uint8Array(await (await request(url, { timeout })).arrayBuffer())
}
