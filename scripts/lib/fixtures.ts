/** Builds an uncompressed tar archive from `[path, content, type]` entries. */
export function tar(entries: Array<[string, string, string?]>): Uint8Array {
  const blocks: Array<Uint8Array> = []
  for (const [path, content, type = '0'] of entries) {
    const header = new Uint8Array(512)
    const body = new TextEncoder().encode(content)
    header.set(new TextEncoder().encode(path), 0)
    header.set(new TextEncoder().encode(`${body.length.toString(8).padStart(11, '0')}\0`), 124)
    header.set(new TextEncoder().encode(type), 156)
    blocks.push(
      header,
      new Uint8Array(Math.ceil(body.length / 512) * 512).fill(0).map((_, index) => body[index] ?? 0),
    )
  }
  blocks.push(new Uint8Array(1024))
  const out = new Uint8Array(blocks.reduce((total, block) => total + block.length, 0))
  let offset = 0
  for (const block of blocks) {
    out.set(block, offset)
    offset += block.length
  }
  return out
}
