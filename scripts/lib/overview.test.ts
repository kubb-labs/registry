import { describe, expect, it } from 'vitest'
import { overviewProblems } from './overview.ts'

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
