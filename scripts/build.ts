/**
 * Builds the static registry protocol (PROTOCOL.md) into `dist/`: `index.json`, one
 * `<owner>/<slug>.json` per record, `categories.json`, and the JSON Schemas. For each record, the
 * manifest (`kubb-extension.json`) and `OVERVIEW.md` are read from its pinned npm tarball, and the
 * record's categories and listing are applied over the manifest. Never runs extension code.
 *
 * A pinned official version released before manifests ships none. The record stays valid, but it is
 * left out of the index until a bump pins a version that ships one.
 *
 * Usage: node scripts/build.ts
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { buildRegistry } from './lib/build.ts'
import { loadRecords } from './lib/load.ts'
import { DIST_DIR, fromRoot, log } from './lib/paths.ts'

function writeJson(relativePath: string, data: unknown): void {
  const path = fromRoot(DIST_DIR, relativePath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

const records = loadRecords()
const { index, details } = await buildRegistry(records)

rmSync(fromRoot(DIST_DIR), { recursive: true, force: true })
writeJson('index.json', index)
for (const detail of details) writeJson(`${detail.id}.json`, detail)
cpSync(fromRoot('categories.json'), fromRoot(DIST_DIR, 'categories.json'))
cpSync(fromRoot('schemas'), fromRoot(DIST_DIR, 'schemas'), { recursive: true })
// GitHub Pages serves the files as they are, without Jekyll.
writeFileSync(fromRoot(DIST_DIR, '.nojekyll'), '')

log('build', `wrote ${details.length} of ${records.length} extensions to ${DIST_DIR}/`)
