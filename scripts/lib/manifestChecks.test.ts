import { describe, expect, it } from 'vitest'
import { manifestProblems, overviewProblems } from './manifestChecks.ts'

const manifest = {
  kind: 'plugin',
  name: 'plugin-ts',
  export: 'pluginTs',
  displayName: 'TypeScript',
  description: 'Generates TypeScript types.',
  compatibility: { kubb: '>=5.8.0', node: '>=22' },
  options: [
    { key: 'outputPath', path: ['output', 'path'], label: 'Output Path', type: 'text', default: 'types' },
    {
      key: 'barrel',
      path: ['output', 'barrel'],
      label: 'Barrel',
      type: 'select',
      default: { type: 'named' },
      choices: [{ value: { type: 'named' } }, { value: false }],
    },
    { key: 'group', path: ['group'], label: 'Group', type: 'select', default: null, choices: [{ label: 'none', value: null }, { value: { type: 'tag' } }] },
  ],
}

describe('manifestProblems', () => {
  it('passes a valid manifest', () => {
    expect(manifestProblems(manifest)).toStrictEqual([])
  })

  it('fails duplicate option keys', () => {
    expect(manifestProblems({ ...manifest, options: [...manifest.options, manifest.options[0]] })).toStrictEqual([
      'option "outputPath" is declared more than once',
    ])
  })

  it('fails a select default that is not among its choices', () => {
    const options = [{ ...manifest.options[1], default: { type: 'all' } }]
    expect(manifestProblems({ ...manifest, options })).toStrictEqual(['option "barrel" has a default that is not one of its choices'])
  })

  it('fails a select without choices', () => {
    const options = [{ key: 'mode', path: ['mode'], label: 'Mode', type: 'select' }]
    expect(manifestProblems({ ...manifest, options })).toStrictEqual(['option "mode" is a select without choices'])
  })

  it('fails an extra compatibility key', () => {
    expect(manifestProblems({ ...manifest, compatibility: { kubb: '>=5', nodejs: '>=22' } })).toStrictEqual([
      'compatibility.nodejs is unknown; use "kubb" or "node"',
    ])
  })

  it('fails a missing export', () => {
    const { export: _export, ...rest } = manifest
    expect(manifestProblems(rest)).toStrictEqual(['export is missing'])
  })

  it('fails an export that is not an identifier', () => {
    expect(manifestProblems({ ...manifest, export: 'plugin-ts' })).toStrictEqual(['export "plugin-ts" is not a JavaScript identifier'])
  })

  it('fails a missing kind and name', () => {
    const { kind: _kind, name: _name, ...rest } = manifest
    expect(manifestProblems(rest)).toStrictEqual(['kind must be "plugin", "adapter", or "parser"', 'name is missing'])
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
