import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import { parseCategories, parseIssueForm, parseSource, repositoryUrlFromNpm } from './issueForm.ts'
import { loadCategories } from './load.ts'
import { fromRoot } from './paths.ts'

const categories = loadCategories()

const body = (source: string, ticks = '- [X] Validation\n- [ ] Types\n- [x] Client') =>
  ['### Source', '', source, '', '### Categories', '', ticks, '', '### Notes', '', '_No response_'].join('\r\n')

describe('parseIssueForm', () => {
  it('reads each field under its heading and treats "_No response_" as empty', () => {
    expect(parseIssueForm(body('@acme/kubb-plugin-graphql'))).toStrictEqual({
      Source: '@acme/kubb-plugin-graphql',
      Categories: '- [X] Validation\n- [ ] Types\n- [x] Client',
      Notes: '',
    })
  })
})

describe('parseSource', () => {
  it.each([
    ['@acme/kubb-plugin-graphql', { kind: 'npm', package: '@acme/kubb-plugin-graphql' }],
    ['@acme/kubb-plugin-graphql@1.2.3', { kind: 'npm', package: '@acme/kubb-plugin-graphql', version: '1.2.3' }],
    ['npm:kubb-plugin-graphql', { kind: 'npm', package: 'kubb-plugin-graphql' }],
    ['https://www.npmjs.com/package/@acme/kubb-plugin-graphql/v/1.2.3', { kind: 'npm', package: '@acme/kubb-plugin-graphql', version: '1.2.3' }],
    ['https://github.com/Acme/kubb-plugins', { kind: 'github', owner: 'acme', repo: 'kubb-plugins' }],
    [
      'https://github.com/acme/kubb-plugins/tree/main/packages/graphql/',
      { kind: 'github', owner: 'acme', repo: 'kubb-plugins', ref: 'main', path: 'packages/graphql' },
    ],
  ])('reads %s', (input, source) => {
    expect(parseSource(input)).toStrictEqual({ source })
  })

  it.each([
    '@acme/x; rm -rf /',
    '@Acme/Plugin',
    '@acme/x@^1.2.3',
    'https://gitlab.com/acme/repo',
    'https://github.com/acme/repo?x=$(id)',
    'https://github.com/acme/repo/tree/main/../../etc',
    'acme/kubb-plugin-graphql/extra',
    '../local/folder',
  ])('rejects %s without echoing it', (input) => {
    const result = parseSource(input)
    expect(result).toStrictEqual({ error: expect.any(String) })
    expect(JSON.stringify(result)).not.toContain(input)
  })
})

describe('parseCategories', () => {
  it('keeps ticked known categories in the form order', () => {
    expect(parseCategories({ input: '- [x] Client\n- [X] Validation\n- [ ] Types\n- [x] Unknown', categories })).toStrictEqual(['validation', 'client'])
  })

  it('lists every category of categories.json in the issue form, in the same order', () => {
    const template = parseYaml(readFileSync(fromRoot('.github/ISSUE_TEMPLATE/submit-extension.yml'), 'utf8')) as {
      body: Array<{ id?: string; attributes: { options?: Array<{ label: string }> } }>
    }
    const options = template.body.find((field) => field.id === 'categories')?.attributes.options?.map((option) => option.label)
    expect(options).toStrictEqual(categories.map((category) => category.label))
  })
})

describe('repositoryUrlFromNpm', () => {
  it.each([
    [
      { type: 'git', url: 'git+https://github.com/acme/kubb-plugins.git', directory: 'packages/graphql' },
      'https://github.com/acme/kubb-plugins/tree/HEAD/packages/graphql',
    ],
    ['github:acme/kubb-plugins', 'https://github.com/acme/kubb-plugins'],
    ['acme/kubb-plugins', 'https://github.com/acme/kubb-plugins'],
    [{ url: 'https://gitlab.com/acme/kubb-plugins' }, null],
    [{ url: 'git+https://github.com/acme/kubb-plugins.git', directory: '../escape' }, 'https://github.com/acme/kubb-plugins'],
    [undefined, null],
  ])('reads %j', (repository, expected) => {
    expect(repositoryUrlFromNpm(repository)).toBe(expected)
  })
})
