/**
 * Semantic checks on a `kubb-extension.json` that the JSON Schema cannot express. Pure: they read
 * the parsed JSON and never load or run the extension.
 */

const KINDS = new Set(['plugin', 'adapter', 'parser'])
const COMPATIBILITY_KEYS = new Set(['kubb', 'node'])
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

const isObject = (value: unknown): value is Record<string, unknown> => value != null && typeof value === 'object' && !Array.isArray(value)

/**
 * Structural equality for JSON values.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))
  }
  if (!isObject(a) || !isObject(b)) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
}

/**
 * Returns what is wrong with a parsed manifest, empty when it passes:
 * `kind`, `name`, and `export` are present, `export` is a JavaScript identifier, `compatibility`
 * holds only `kubb` and `node`, option keys are unique, every select has choices, and a select's
 * default is one of its choice values.
 */
export function manifestProblems(manifest: unknown): Array<string> {
  if (!isObject(manifest)) return ['the manifest must be a JSON object']
  const problems: Array<string> = []
  const { kind, name, export: exportName, compatibility, options } = manifest

  if (typeof kind !== 'string' || !KINDS.has(kind)) problems.push('kind must be "plugin", "adapter", or "parser"')
  if (typeof name !== 'string' || !name) problems.push('name is missing')
  if (typeof exportName !== 'string' || !exportName) problems.push('export is missing')
  else if (!IDENTIFIER.test(exportName)) problems.push(`export "${exportName}" is not a JavaScript identifier`)

  if (compatibility !== undefined) {
    if (!isObject(compatibility)) problems.push('compatibility must be an object')
    else
      for (const key of Object.keys(compatibility).filter((key) => !COMPATIBILITY_KEYS.has(key)))
        problems.push(`compatibility.${key} is unknown; use "kubb" or "node"`)
  }

  if (options !== undefined && !Array.isArray(options)) problems.push('options must be an array')
  const seen = new Set<string>()
  for (const [index, option] of (Array.isArray(options) ? options : []).entries()) {
    if (!isObject(option)) {
      problems.push(`options[${index}] must be an object`)
      continue
    }
    const label = typeof option.key === 'string' ? `option "${option.key}"` : `options[${index}]`
    if (typeof option.key === 'string') {
      if (seen.has(option.key)) problems.push(`${label} is declared more than once`)
      seen.add(option.key)
    }
    if (option.type !== 'select') continue
    const choices = Array.isArray(option.choices) ? option.choices : []
    if (!choices.length) {
      problems.push(`${label} is a select without choices`)
      continue
    }
    if ('default' in option && !choices.some((choice) => isObject(choice) && deepEqual(choice.value, option.default))) {
      problems.push(`${label} has a default that is not one of its choices`)
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
