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
import manifestSchema from '@kubb/core/schemas/kubb-extension.json' with { type: 'json' }
import { buildRegistry } from './lib/build.ts'
import { loadRecords } from './lib/load.ts'
import { fromRoot } from './lib/paths.ts'

function writeJson({ path, data }: { path: string; data: unknown }): void {
  const file = fromRoot('dist', path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

const records = loadRecords()
const { index, details } = await buildRegistry(records)

rmSync(fromRoot('dist'), { recursive: true, force: true })
writeJson({ path: 'index.json', data: index })
for (const detail of details) writeJson({ path: `${detail.id}.json`, data: detail })
cpSync(fromRoot('categories.json'), fromRoot('dist', 'categories.json'))
cpSync(fromRoot('schemas'), fromRoot('dist', 'schemas'), { recursive: true })
// The manifest schema is owned by @kubb/core; the registry publishes it beside its own record schema.
writeJson({ path: 'schemas/kubb-extension.json', data: manifestSchema })

console.log(`[build] wrote ${details.length} of ${records.length} extensions to dist/`)
