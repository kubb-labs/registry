/**
 * The load check for a submitted extension: the manifest's `export` is a factory, and calling it
 * with no options returns an extension whose `meta.name` equals the manifest's `name`.
 */
export function loadProblems({ manifest, mod }: { manifest: { export?: unknown; name?: unknown }; mod: Record<string, unknown> }): Array<string> {
  if (typeof manifest.export !== 'string') return ['kubb-extension.json has no `export`.']
  const factory = mod[manifest.export]
  if (typeof factory !== 'function') return [`The package does not export a function named \`${manifest.export}\`.`]
  let extension: { meta?: { name?: unknown } } | undefined
  try {
    extension = factory()
  } catch (error) {
    return [`\`${manifest.export}()\` threw: ${error instanceof Error ? error.message : String(error)}`]
  }
  const name = extension?.meta?.name
  if (name !== manifest.name) return [`\`${manifest.export}().meta.name\` is \`${String(name)}\`, but kubb-extension.json names \`${String(manifest.name)}\`.`]
  return []
}
