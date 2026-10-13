/**
 * Reads and checks the Markdown docs a package ships in `docs/`: `overview.md`, `options.md`, and
 * `guides/<id>.md`. The docs are untrusted, so clients render them as plain Markdown with a few
 * components. These checks report what would not render.
 */
import type { RegistryGuide } from '@kubb/core'
import { SLUG_PATTERN } from './records.ts'

export const DOCS_OVERVIEW_FILE = 'docs/overview.md'
export const DOCS_OPTIONS_FILE = 'docs/options.md'

/** A version that ships more guides keeps the first ones by file name. */
const MAX_GUIDES = 50
const DOCS_FILE = /^docs\/(?:guides\/)?[^/]+\.md$/
const GUIDE_FILE = /^docs\/guides\/([^/]+)\.md$/
/** The `::` components clients render. Any other shows up as text. */
const COMPONENTS = new Set(['code-group', 'field-group', 'field', 'steps', 'code-collapse', 'tabs', 'tabs-item'])

const TITLE = /^#[ \t]+(\S.*?)[ \t]*$/
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/
const COMPONENT = /^\s*:{2,}([A-Za-z][\w-]*)?/
/** A line that starts a block other than a paragraph, so it cannot be or continue a description. */
const BLOCK_START = /^\s*(?:#{1,6}(?:\s|$)|`{3,}|~{3,}|>|:{2,}|\||<|[-*+]\s|\d+[.)]\s|(?:-{3,}|\*{3,}|_{3,})\s*$)/
const INCLUDE = /<!--\s*@include/
/** An HTML tag or comment. A Markdown autolink such as `<https://kubb.dev>` does not match. */
const HTML = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>|<!--(?!\s*@include)/
const CODE_SPAN = /(`+).*?\1/g

/**
 * The docs files the registry reads from a package: `docs/<name>.md` and `docs/guides/<name>.md`,
 * by path relative to the package root.
 */
export function isDocsFile(path: string): boolean {
  return DOCS_FILE.test(path)
}

/**
 * The title and the description of a docs file: the `# ` heading on its first line, and the first
 * paragraph after it with its lines joined. Each is null when missing.
 */
export function parseDocsFile(content: string): { title: string | null; description: string | null } {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/)
  const title = lines[0]?.match(TITLE)?.[1] ?? null
  if (title === null) return { title, description: null }
  const start = lines.findIndex((line, index) => index > 0 && line.trim() !== '')
  if (start === -1 || BLOCK_START.test(lines[start]!)) return { title, description: null }
  const end = lines.findIndex((line, index) => index > start && (line.trim() === '' || BLOCK_START.test(line)))
  const description = lines
    .slice(start, end === -1 ? undefined : end)
    .map((line) => line.trim())
    .join(' ')
  return { title, description }
}

/**
 * The 1-based numbers of the lines that break each syntax rule, and of each unknown component by name.
 */
type SyntaxFindings = { html: Array<number>; include: Array<number>; twoslash: Array<number>; components: Map<string, Array<number>> }

function syntaxFindings(content: string): SyntaxFindings {
  const findings: SyntaxFindings = { html: [], include: [], twoslash: [], components: new Map() }
  let fence: string | null = null
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    const number = index + 1
    if (INCLUDE.test(line)) findings.include.push(number)
    const fenceMatch = line.match(FENCE)
    if (fence !== null) {
      const closes = fenceMatch !== null && fenceMatch[1]![0] === fence[0] && fenceMatch[1]!.length >= fence.length && fenceMatch[2]!.trim() === ''
      if (closes) fence = null
      continue
    }
    if (fenceMatch) {
      fence = fenceMatch[1]!
      if (/\btwoslash\b/.test(fenceMatch[2]!)) findings.twoslash.push(number)
      continue
    }
    const component = line.match(COMPONENT)
    if (component) {
      // A component line holds attributes, such as `type="Array<string>"`, not HTML.
      const name = component[1]
      if (name !== undefined && !COMPONENTS.has(name)) findings.components.set(name, [...(findings.components.get(name) ?? []), number])
      continue
    }
    if (HTML.test(line.replace(CODE_SPAN, ''))) findings.html.push(number)
  }
  return findings
}

const ALLOWED_COMPONENTS = [...COMPONENTS].map((name) => `::${name}`).join(', ')

function onLines(numbers: Array<number>): string {
  return `${numbers.length === 1 ? 'line' : 'lines'} ${numbers.join(', ')}`
}

/**
 * Returns what is wrong with a docs file, empty when it passes: a missing title or description,
 * raw HTML outside code fences, `<!--@include`, a `twoslash` code fence, or a `::` component that
 * clients do not render. The install-command rule for overviews is in `overview.ts`.
 */
export function docsProblems(content: string): Array<string> {
  const { title, description } = parseDocsFile(content)
  const { html, include, twoslash, components } = syntaxFindings(content)
  return [
    ...(title === null ? ['the first line is not a "# Title" heading'] : []),
    ...(title !== null && description === null ? ['no paragraph follows the title to serve as the description'] : []),
    ...(html.length ? [`raw HTML outside code fences on ${onLines(html)}; use Markdown`] : []),
    ...(include.length ? [`<!--@include on ${onLines(include)}; paste the included text instead`] : []),
    ...(twoslash.length ? [`a twoslash code fence on ${onLines(twoslash)}; remove twoslash`] : []),
    ...[...components].map(([name, lines]) => `the ::${name} component on ${onLines(lines)} does not render; use Markdown or ${ALLOWED_COMPONENTS}`),
  ]
}

/**
 * A problem with one docs file, by path relative to the package root.
 */
export type DocsProblem = { path: string; problem: string }

/**
 * Checks one guide. A guide without a title, a description, or a kebab-case id is left out.
 */
function readGuide({ path, content }: { path: string; content: string }): { guide: RegistryGuide | null; problems: Array<DocsProblem> } {
  const id = path.match(GUIDE_FILE)?.[1] ?? ''
  const { title, description } = parseDocsFile(content)
  const idProblems = SLUG_PATTERN.test(id) ? [] : [`the guide id "${id}" is not kebab case; rename the file`]
  const problems = [...idProblems, ...docsProblems(content)].map((problem) => ({ path, problem }))
  const listed = !idProblems.length && title !== null && description !== null
  return { guide: listed ? { id, title, description, content } : null, problems }
}

/**
 * The docs a version ships, from its files by path relative to the package root: the overview,
 * the options page, and the guides sorted by file name. A guide that fails a check is left out,
 * never the extension.
 */
export function readDocs(files: ReadonlyMap<string, string>): {
  overview: string | null
  options: string | null
  guides: Array<RegistryGuide>
  problems: Array<DocsProblem>
} {
  const pageProblems = [DOCS_OVERVIEW_FILE, DOCS_OPTIONS_FILE].flatMap((path) => {
    const content = files.get(path)
    return content === undefined ? [] : docsProblems(content).map((problem) => ({ path, problem }))
  })
  const guidePaths = [...files.keys()].filter((path) => GUIDE_FILE.test(path)).toSorted()
  const capProblems =
    guidePaths.length > MAX_GUIDES
      ? [{ path: 'docs/guides/', problem: `holds ${guidePaths.length} guides; only the first ${MAX_GUIDES} by file name are listed` }]
      : []
  const guides = guidePaths.slice(0, MAX_GUIDES).map((path) => readGuide({ path, content: files.get(path)! }))

  return {
    overview: files.get(DOCS_OVERVIEW_FILE) ?? null,
    options: files.get(DOCS_OPTIONS_FILE) ?? null,
    guides: guides.flatMap(({ guide }) => guide ?? []),
    problems: [...pageProblems, ...capProblems, ...guides.flatMap(({ problems }) => problems)],
  }
}
