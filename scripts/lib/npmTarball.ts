/**
 * Reads files from a published npm version without installing or running it: the tarball is
 * downloaded from the npm registry, checked against its SHA-512 integrity, and read in memory.
 * Nothing is extracted to disk.
 */
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { fetchBytes, fetchJson } from './http.ts'

/** Files larger than this are refused instead of read. */
const MAX_FILE_BYTES = 256 * 1024
/** A larger unpacked tarball is refused, so a hostile package cannot exhaust memory. */
const MAX_TARBALL_BYTES = 64 * 1024 * 1024
const BLOCK = 512

/**
 * Reads the regular files at the package root whose names are in `wanted` from an uncompressed tar
 * archive. npm tarballs hold one top-level folder (`package/`), so `package/OVERVIEW.md` is returned
 * as `OVERVIEW.md`. Links, folders, and nested files are skipped.
 */
export function readTarFiles(tar: Uint8Array, wanted: ReadonlySet<string>): Map<string, string> {
  const files = new Map<string, string>()
  const decoder = new TextDecoder()
  const field = (offset: number, length: number) => decoder.decode(tar.subarray(offset, offset + length)).replace(/\0[\s\S]*$/, '')
  let offset = 0
  while (offset + BLOCK <= tar.length) {
    const name = field(offset, 100)
    if (!name) break
    const size = Number.parseInt(field(offset + 124, 12).trim() || '0', 8)
    if (!Number.isFinite(size) || size < 0) throw new Error('corrupt tar header')
    const type = field(offset + 156, 1)
    const prefix = field(offset + 345, 155)
    const path = prefix ? `${prefix}/${name}` : name
    const data = offset + BLOCK
    const file = path.match(/^[^/]+\/([^/]+)$/)?.[1]
    if ((type === '0' || type === '') && file && wanted.has(file) && !files.has(file)) {
      if (size > MAX_FILE_BYTES) throw new Error(`${file} is larger than ${MAX_FILE_BYTES} bytes`)
      files.set(file, decoder.decode(tar.subarray(data, data + size)))
    }
    offset = data + Math.ceil(size / BLOCK) * BLOCK
  }
  return files
}

/**
 * Whether `bytes` match an npm `sha512-<base64>` integrity string.
 */
export function matchesIntegrity(bytes: Uint8Array, integrity: string): boolean {
  const expected = integrity.match(/^sha512-([A-Za-z0-9+/]+={0,2})$/)?.[1]
  return expected !== undefined && createHash('sha512').update(bytes).digest('base64') === expected
}

/**
 * The files an npm version ships at its package root, `null` for each one it does not ship, or an
 * error when the version or its tarball cannot be read.
 */
export type PackageFiles = { status: 'ok'; files: Map<string, string> } | { status: 'error'; message: string }

type Packument = { versions?: Record<string, { dist?: { tarball?: string; integrity?: string } }> }

export async function fetchPackageFiles({
  pkg,
  version,
  files,
  scope,
}: {
  pkg: string
  version: string
  files: Array<string>
  scope: string
}): Promise<PackageFiles> {
  const packument = await fetchJson<Packument>({ url: `https://registry.npmjs.org/${pkg}`, scope })
  if (!packument) return { status: 'error', message: `could not read ${pkg} from npm` }
  const dist = packument.versions?.[version]?.dist
  if (!dist) return { status: 'error', message: `${pkg}@${version} is not published on npm` }
  const { tarball, integrity } = dist
  if (!tarball?.startsWith('https://registry.npmjs.org/') || !integrity)
    return { status: 'error', message: `${pkg}@${version} has no npm tarball with an integrity hash` }
  try {
    const bytes = await fetchBytes(tarball, { timeout: 60_000 })
    if (!matchesIntegrity(bytes, integrity)) return { status: 'error', message: `${pkg}@${version}: the tarball does not match its integrity hash` }
    const tar = gunzipSync(bytes, { maxOutputLength: MAX_TARBALL_BYTES })
    return { status: 'ok', files: readTarFiles(tar, new Set(files)) }
  } catch (err) {
    return { status: 'error', message: `${pkg}@${version}: ${(err as Error).message}` }
  }
}
