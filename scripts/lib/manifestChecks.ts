/**
 * Semantic checks on a `kubb-extension.json` that the JSON Schema cannot express. Pure: they read
 * the parsed JSON and never load or run the extension.
 */
import { isDeepStrictEqual } from 'node:util'
import type { ExtensionManifest } from './types.ts'

/**
 * Returns what is wrong with a manifest that passed the JSON Schema, empty when it passes: option
 * keys are unique, and a select's default is one of its choice values.
 */
export function manifestProblems({ options = [] }: ExtensionManifest): Array<string> {
  const problems: Array<string> = []
  const seen = new Set<string>()
  for (const option of options) {
    if (seen.has(option.key)) problems.push(`option "${option.key}" is declared more than once`)
    seen.add(option.key)
    if (option.type === 'select' && 'default' in option && !option.choices?.some((choice) => isDeepStrictEqual(choice.value, option.default))) {
      problems.push(`option "${option.key}" has a default that is not one of its choices`)
    }
  }
  return problems
}

/** Install commands an overview must not contain: the page already shows how to install. */
const INSTALL_COMMAND = /\b(?:kubb\s+add|npm\s+install|npm\s+i(?=\s|$)|pnpm\s+add|yarn\s+add)\b/i

/**
 * Returns what is wrong with an `OVERVIEW.md` or a registry overview, empty when it passes. The
 * rest of the content contract is reviewed by a person (REVIEW.md).
 */
export function overviewProblems(overview: string): Array<string> {
  const problems: Array<string> = []
  if (!overview.trim()) problems.push('the overview is empty')
  if (INSTALL_COMMAND.test(overview)) problems.push('the overview contains an install command (kubb add, npm install, npm i, pnpm add, or yarn add); remove it')
  return problems
}
