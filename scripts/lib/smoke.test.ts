import { describe, expect, it } from 'vitest'
import { loadProblem } from './smoke.ts'

const manifest = { export: 'pluginAcme', name: 'plugin-acme' }

describe('loadProblem', () => {
  it('passes when the factory returns the manifest name', () => {
    expect(loadProblem({ manifest, mod: { pluginAcme: () => ({ meta: { name: 'plugin-acme' } }) } })).toBeUndefined()
  })

  it.each([
    ['no export field', { name: 'plugin-acme' }, {}, 'has no `export`'],
    ['a missing factory', manifest, {}, 'does not export a function named `pluginAcme`'],
    [
      'a throwing factory',
      manifest,
      {
        pluginAcme: () => {
          throw new Error('boom')
        },
      },
      'threw: boom',
    ],
    ['a mismatched name', manifest, { pluginAcme: () => ({ meta: { name: 'plugin-other' } }) }, 'is `plugin-other`'],
  ])('reports %s', (_, m, mod, expected) => {
    expect(loadProblem({ manifest: m, mod })).toContain(expected)
  })
})
