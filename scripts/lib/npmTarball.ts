/**
 * Reads files from a published npm version without installing or running it: the tarball is
 * downloaded from the npm registry, checked against its SHA-512 integrity, and read in memory.
 * Nothing is extracted to disk.
 */
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { fetchBytes } from './http.ts'
import { fetchPackument } from './npm.ts'

/** Files larger than this are skipped instead of read. */
export const MAX_FILE_BYTES = 256 * 1024
/** A larger unpacked tarball is refused, so a hostile package cannot exhaust memory. */
export const MAX_TARBALL_BYTES = 64 * 1024 * 1024
const BLOCK = 512

/**
 * The files read from a tarball, by path relative to the package root, the wanted files that were
 * skipped for being larger than the limit, and the path of every regular file in the archive.
 */
export type TarFiles = { files: Map<string, string>; tooLarge: Array<string>; paths: Set<string> }

/**
 * Reads the regular files that `wanted` accepts from an uncompressed tar archive. npm tarballs
 * hold one top-level folder (`package/`), so `wanted` gets, and the result holds, paths relative
 * to it: `package/docs/overview.md` becomes `docs/overview.md`. Links and folders are skipped.
 * When a path appears twice, the first regular copy wins. A file larger than 256 KiB is listed in
 * `tooLarge` instead of read, unless `truncated` accepts it: then its first 256 KiB are read.
 */
export function readTarFiles({
  tar,
  wanted,
  truncated = () => false,
}: {
  tar: Uint8Array
  wanted: (path: string) => boolean
  truncated?: (path: string) => boolean
}): TarFiles {
  const files = new Map<string, string>()
  const tooLarge: Array<string> = []
  const paths = new Set<string>()
  const seen = new Set<string>()
  const decoder = new TextDecoder()
  const field = ({ offset, length }: { offset: number; length: number }) => decoder.decode(tar.subarray(offset, offset + length)).replace(/\0[\s\S]*$/, '')
  for (let offset = 0; offset + BLOCK <= tar.length;) {
    const name = field({ offset, length: 100 })
    if (!name) break
    const size = Number.parseInt(field({ offset: offset + 124, length: 12 }).trim() || '0', 8)
    if (!Number.isFinite(size) || size < 0) throw new Error('corrupt tar header')
    const type = field({ offset: offset + 156, length: 1 })
    const prefix = field({ offset: offset + 345, length: 155 })
    const path = (prefix ? `${prefix}/${name}` : name).match(/^[^/]+\/(.+)$/)?.[1]
    offset += BLOCK
    if ((type === '0' || type === '') && path) paths.add(path)
    if ((type === '0' || type === '') && path && !seen.has(path) && wanted(path)) {
      seen.add(path)
      const cut = size > MAX_FILE_BYTES && truncated(path)
      if (size > MAX_FILE_BYTES && !cut) tooLarge.push(path)
      if (size <= MAX_FILE_BYTES || cut) files.set(path, decoder.decode(tar.subarray(offset, offset + Math.min(size, MAX_FILE_BYTES))))
    }
    offset += Math.ceil(size / BLOCK) * BLOCK
  }
  return { files, tooLarge, paths }
}

/**
 * Whether `bytes` match an npm `sha512-<base64>` integrity string.
 */
export function matchesIntegrity({ bytes, integrity }: { bytes: Uint8Array; integrity: string }): boolean {
  const expected = integrity.match(/^sha512-([A-Za-z0-9+/]+={0,2})$/)?.[1]
  return expected !== undefined && createHash('sha512').update(bytes).digest('base64') === expected
}

/**
 * The files an npm version ships that `wanted` accepts, by path relative to the package root, or
 * an error when the version or its tarball cannot be read.
 */
export async function fetchPackageFiles({
  pkg,
  version,
  wanted,
  truncated,
  scope,
}: {
  pkg: string
  version: string
  wanted: (path: string) => boolean
  truncated?: (path: string) => boolean
  scope: string
}): Promise<({ status: 'ok' } & TarFiles) | { status: 'error'; message: string }> {
  const packument = await fetchPackument({ pkg, scope })
  if (!packument) return { status: 'error', message: `could not read ${pkg} from npm` }
  const dist = packument.versions?.[version]?.dist
  if (!dist) return { status: 'error', message: `${pkg}@${version} is not published on npm` }
  const { tarball, integrity } = dist
  if (!tarball?.startsWith('https://registry.npmjs.org/') || !integrity)
    return { status: 'error', message: `${pkg}@${version} has no npm tarball with an integrity hash` }
  try {
    const bytes = await fetchBytes({ url: tarball, timeout: 60_000 })
    if (!matchesIntegrity({ bytes, integrity })) return { status: 'error', message: `${pkg}@${version}: the tarball does not match its integrity hash` }
    const tar = gunzipSync(bytes, { maxOutputLength: MAX_TARBALL_BYTES })
    return { status: 'ok', ...readTarFiles({ tar, wanted, truncated }) }
  } catch (err) {
    return { status: 'error', message: `${pkg}@${version}: ${(err as Error).message}` }
  }
}
