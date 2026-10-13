import { describe, expect, it } from 'vitest'
import { manifestProblems, overviewProblems } from './manifestChecks.ts'
import type { ExtensionManifest, ExtensionManifestOption } from './types.ts'

const outputPath: ExtensionManifestOption = { key: 'outputPath', path: ['output', 'path'], label: 'Output Path', type: 'text', default: 'types' }
const barrel: ExtensionManifestOption = {
  key: 'barrel',
  path: ['output', 'barrel'],
  label: 'Barrel',
  type: 'select',
  default: { type: 'named' },
  choices: [{ value: { type: 'named' } }, { value: false }],
}
const group: ExtensionManifestOption = {
  key: 'group',
  path: ['group'],
  label: 'Group',
  type: 'select',
  default: null,
  choices: [{ label: 'none', value: null }, { value: { type: 'tag' } }],
}
const manifest: ExtensionManifest = {
  kind: 'plugin',
  name: 'plugin-ts',
  export: 'pluginTs',
  displayName: 'TypeScript',
  description: 'Generates TypeScript types.',
  options: [outputPath, barrel, group],
}

describe('manifestProblems', () => {
  it('passes a valid manifest', () => {
    expect(manifestProblems(manifest)).toStrictEqual([])
  })

  it('fails duplicate option keys', () => {
    expect(manifestProblems({ ...manifest, options: [outputPath, barrel, outputPath] })).toStrictEqual(['option "outputPath" is declared more than once'])
  })

  it('fails a select default that is not among its choices', () => {
    expect(manifestProblems({ ...manifest, options: [{ ...barrel, default: { type: 'all' } }] })).toStrictEqual([
      'option "barrel" has a default that is not one of its choices',
    ])
  })
})

describe('overviewProblems', () => {
  it('passes plain prose', () => {
    expect(overviewProblems('Generates TypeScript types from your spec.\n\nAdd it after the adapter.')).toStrictEqual([])
  })

  it.each(['Run `kubb add plugin-ts`.', 'npm install @kubb/plugin-ts', 'npm i -D x', 'pnpm add x', 'yarn add x'])('fails "%s"', (overview) => {
    expect(overviewProblems(overview)).toHaveLength(1)
  })

  it('fails an empty overview', () => {
    expect(overviewProblems('  \n')).toStrictEqual(['the overview is empty'])
  })
})
