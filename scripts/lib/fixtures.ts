import { gzipSync } from 'node:zlib'

/** Builds an uncompressed tar archive from `[path, content, type]` entries. */
export function tar(entries: Array<[string, string, string?]>): Uint8Array {
  const encoder = new TextEncoder()
  const blocks = entries.flatMap(([path, content, type = '0']) => {
    const body = encoder.encode(content)
    const header = new Uint8Array(512)
    header.set(encoder.encode(path), 0)
    header.set(encoder.encode(`${body.length.toString(8).padStart(11, '0')}\0`), 124)
    header.set(encoder.encode(type), 156)
    const data = new Uint8Array(Math.ceil(body.length / 512) * 512)
    data.set(body)
    return [header, data]
  })
  return Buffer.concat([...blocks, new Uint8Array(1024)])
}

/**
 * A gzipped archive shaped like the one GitHub serves for a commit: a `pax_global_header`, then
 * every file under `<repo>-<commit>/`.
 */
export function githubArchive({ repo, commit, files }: { repo: string; commit: string; files: Array<[string, string]> }): Uint8Array {
  const root = `${repo}-${commit.slice(0, 7)}`
  return gzipSync(
    tar([
      ['pax_global_header', `52 comment=${commit}\n`, 'g'],
      [`${root}/`, '', '5'],
      ...files.map(([path, content]): [string, string] => [`${root}/${path}`, content]),
    ]),
  )
}
