/**
 * Reads the headline change of a version from the `CHANGELOG.md` its package ships, in the format
 * Changesets writes: a `## <version>` section with `### Major Changes`, `### Minor Changes`, and
 * `### Patch Changes` lists. The text comes from the package author, so it is reduced to plain text.
 */
import { stripVTControlCharacters } from 'node:util'
import type { RegistryChanges } from './types.ts'

export const CHANGELOG_FILE = 'CHANGELOG.md'

/** `## 1.2.0`, `## v1.2.0`, or `## [1.2.0](<url>) (<date>)`. */
const VERSION_HEADING = /^##[ \t]+\[?v?(\d[^\]\s]*)/
const SECTION_HEADING = /^##[ \t]/
const BULLET = /^[-*][ \t]+(.*)$/
/** The pull request, commit, and thanks links Changesets puts before the text: `[#12](…) [`abc`](…) Thanks [@me](…)! - `. */
const CHANGESETS_PREFIX = /^(?:\[[^\]]*\]\([^)]*\)\s*)*(?:Thanks \[@[^\]]*\]\([^)]*\)!\s*)?-\s+/
const GUIDE = /https:\/\/[^\s)<>\]"']*migrat[^\s)<>\]"']*/i

/** The first sentence of one Markdown line as plain text: no links, images, PR refs, code marks, emphasis, or HTML. */
export function toPlainText(markdown: string): string {
  const text = stripVTControlCharacters(markdown)
    .replace(CHANGESETS_PREFIX, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\(?\[#\d+\]\([^)]*\)\)?/g, '')
    .replace(/\(#\d+\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_\s][^*_]*)[*_](?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.split(/(?<=[.!?])\s/)[0]!.replace(/\.$/, '')
}

/**
 * The headline change of `version`: the first entry of its section that is not a dependency bump,
 * whether the section lists major changes, and the first migration guide it links to. Null when
 * the changelog has no such section or entry.
 */
export function readChanges({ changelog, version }: { changelog: string; version: string }): RegistryChanges | null {
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex((line) => line.match(VERSION_HEADING)?.[1] === version)
  if (start === -1) return null
  const next = lines.findIndex((line, index) => index > start && SECTION_HEADING.test(line))
  const section = lines.slice(start + 1, next === -1 ? undefined : next)
  const summary = section
    .flatMap((line) => line.match(BULLET)?.[1] ?? [])
    .map(toPlainText)
    .find((text) => text !== '' && !/^Updated dependencies/i.test(text))
  if (!summary) return null
  const guide = section.join('\n').match(GUIDE)?.[0]
  return { summary, ...(section.some((line) => /^###[ \t]+Major Changes/i.test(line)) && { breaking: true }), ...(guide && { guide }) }
}
