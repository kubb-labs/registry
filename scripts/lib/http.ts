import { setTimeout as sleep } from 'node:timers/promises'

const RETRIES = 2

type Target = { url: string; headers?: Record<string, string> }

/**
 * `fetch` with a timeout and two retries on network errors and 5xx answers. Throws on any other
 * non-2xx answer.
 */
async function request({ url, headers, timeout = 10_000, attempt = 0 }: Target & { timeout?: number; attempt?: number }): Promise<Response> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) }).catch((err: unknown) => err)
  const answered = response instanceof Response
  if (answered && response.ok) return response
  if (attempt >= RETRIES || (answered && response.status < 500)) throw answered ? new Error(`${url} answered ${response.status}`) : response
  await sleep(250 * (attempt + 1))
  return request({ url, headers, timeout, attempt: attempt + 1 })
}

/**
 * The JSON at `url`, or null after a warning when it cannot be read.
 */
export async function fetchJson<T>({ url, headers, scope = 'http' }: Target & { scope?: string }): Promise<T | null> {
  try {
    return (await (await request({ url, headers })).json()) as T
  } catch (err) {
    console.warn(`[${scope}] ⚠ ${(err as Error).message}`)
    return null
  }
}

/**
 * The bytes at `url`. Throws when they cannot be read.
 */
export async function fetchBytes({ url, timeout }: { url: string; timeout?: number }): Promise<Uint8Array> {
  return new Uint8Array(await (await request({ url, timeout })).arrayBuffer())
}
