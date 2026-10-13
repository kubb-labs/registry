import { describe, expect, it } from 'vitest'
import { docsProblems, isDocsFile, parseDocsFile, readDocs } from './docs.ts'

const guide = (title: string) => `# ${title}\n\nThe ${title.toLowerCase()} guide.\n`

describe('isDocsFile', () => {
  it.each(['docs/overview.md', 'docs/options.md', 'docs/guides/authentication.md'])('accepts %s', (path) => {
    expect(isDocsFile(path)).toBe(true)
  })

  it.each(['OVERVIEW.md', 'docs/guides/advanced/retries.md', 'docs/guides/diagram.png', 'docs/notes.txt', 'src/docs/options.md'])('skips %s', (path) => {
    expect(isDocsFile(path)).toBe(false)
  })
})

describe('parseDocsFile', () => {
  it('reads the title and joins the lines of the first paragraph', () => {
    expect(parseDocsFile('# Options\n\nPass these options to `pluginTs()`.\nEach one is optional.\n\n## output\n')).toStrictEqual({
      title: 'Options',
      description: 'Pass these options to `pluginTs()`. Each one is optional.',
    })
  })

  it('ignores a byte order mark before the title', () => {
    expect(parseDocsFile('\uFEFF# Options\n\nText.').title).toBe('Options')
  })

  it('returns no title when the first line is not a heading', () => {
    expect(parseDocsFile('\n# Options\n\nText.')).toStrictEqual({ title: null, description: null })
  })

  it('returns no description when a heading, code fence, or callout follows the title', () => {
    expect(parseDocsFile('# Options\n\n## output\n\nText.').description).toBe(null)
    expect(parseDocsFile('# Options\n\n```ts\nconst a = 1\n```\n').description).toBe(null)
    expect(parseDocsFile('# Options\n\n> [!NOTE]\n> Text.\n').description).toBe(null)
    expect(parseDocsFile('# Options\n').description).toBe(null)
  })
})

describe('docsProblems', () => {
  it('passes Markdown with code fences and the allowed components', () => {
    const content = [
      '# Options',
      '',
      'Pass these options to `pluginTs()`. Use `Array<string>` for lists.',
      '',
      '::field-group',
      ':::field{name="output" type="Array<string>"}',
      'Where the files go. See <https://kubb.dev>.',
      ':::',
      '::',
      '',
      '::code-group',
      '```typescript [kubb.config.ts]',
      'const html = "<div>"',
      '```',
      '::',
    ].join('\n')

    expect(docsProblems(content)).toStrictEqual([])
  })

  it('reports a missing title', () => {
    expect(docsProblems('Some text.')).toStrictEqual(['the first line is not a "# Title" heading'])
  })

  it('reports a missing description', () => {
    expect(docsProblems('# Options\n\n## output\n')).toStrictEqual(['no paragraph follows the title to serve as the description'])
  })

  it('reports raw HTML outside code fences with its lines', () => {
    expect(docsProblems('# Options\n\nText.\n\n<div align="center">\n\n</div>\n\n<!-- note -->')).toStrictEqual([
      'raw HTML outside code fences on lines 5, 7, 9; use Markdown',
    ])
  })

  it('reports an include, even inside a code fence', () => {
    expect(docsProblems('# Options\n\nText.\n\n<!--@include: ./snippet.md-->\n\n```md\n<!--@include: ./a.md-->\n```')).toStrictEqual([
      '<!--@include on lines 5, 8; paste the included text instead',
    ])
  })

  it('reports a twoslash code fence', () => {
    expect(docsProblems('# Options\n\nText.\n\n```typescript twoslash [kubb.config.ts]\nconst a = 1\n```')).toStrictEqual([
      'a twoslash code fence on line 5; remove twoslash',
    ])
  })

  it('reports each component outside the allowlist once', () => {
    expect(docsProblems('# Options\n\nText.\n\n::file-tree\n::\n\n::file-tree\n::\n\n::steps\n::')).toStrictEqual([
      'the ::file-tree component on lines 5, 8 does not render; use Markdown or ::code-group, ::field-group, ::field, ::steps, ::code-collapse, ::tabs, ::tabs-item',
    ])
  })
})

describe('readDocs', () => {
  it('reads the overview, the options page, and the guides sorted by file name', () => {
    const files = new Map([
      ['kubb-extension.json', '{}'],
      ['docs/overview.md', '# X\n\nGenerates X.\n'],
      ['docs/options.md', '# Options\n\nPass these options to `pluginX()`.\n'],
      ['docs/guides/retries.md', guide('Retries')],
      ['docs/guides/authentication.md', guide('Authentication')],
    ])

    expect(readDocs(files)).toStrictEqual({
      overview: '# X\n\nGenerates X.\n',
      options: '# Options\n\nPass these options to `pluginX()`.\n',
      guides: [
        { id: 'authentication', title: 'Authentication', description: 'The authentication guide.', content: guide('Authentication') },
        { id: 'retries', title: 'Retries', description: 'The retries guide.', content: guide('Retries') },
      ],
      problems: [],
    })
  })

  it('returns null and no guides when the version ships no docs', () => {
    expect(readDocs(new Map())).toStrictEqual({ overview: null, options: null, guides: [], problems: [] })
  })

  it('leaves out a guide without a title or with an id that is not kebab case, and reports both', () => {
    const files = new Map([
      ['docs/guides/Auth_Flow.md', guide('Auth flow')],
      ['docs/guides/no-title.md', 'Text.\n'],
      ['docs/guides/retries.md', guide('Retries')],
    ])

    const { guides, problems } = readDocs(files)

    expect(guides.map(({ id }) => id)).toStrictEqual(['retries'])
    expect(problems).toStrictEqual([
      { path: 'docs/guides/Auth_Flow.md', problem: 'the guide id "Auth_Flow" is not kebab case; rename the file' },
      { path: 'docs/guides/no-title.md', problem: 'the first line is not a "# Title" heading' },
    ])
  })

  it('keeps a guide with a syntax problem and reports it', () => {
    const content = '# Retries\n\nHow to retry.\n\n<br>\n'
    const { guides, problems } = readDocs(new Map([['docs/guides/retries.md', content]]))

    expect(guides).toHaveLength(1)
    expect(problems).toStrictEqual([{ path: 'docs/guides/retries.md', problem: 'raw HTML outside code fences on line 5; use Markdown' }])
  })

  it('lists at most 50 guides', () => {
    const files = new Map(Array.from({ length: 52 }, (_, index) => [`docs/guides/guide-${String(index).padStart(2, '0')}.md`, guide(`Guide ${index}`)]))

    const { guides, problems } = readDocs(files)

    expect(guides).toHaveLength(50)
    expect(guides.at(-1)?.id).toBe('guide-49')
    expect(problems).toStrictEqual([{ path: 'docs/guides/', problem: 'holds 52 guides; only the first 50 by file name are listed' }])
  })
})
