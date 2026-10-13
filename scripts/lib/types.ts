/**
 * Types for the extension registry (see schemas/kubb-extension.json and schemas/registry-record.json).
 * `ExtensionManifest`, `RegistryEntry`, `RegistryDetail`, and `RegistryIndex` mirror the types
 * `@kubb/core` exports, so the registry needs no Kubb dependency.
 */

export type JSONValue = string | number | boolean | null | Array<JSONValue> | { [key: string]: JSONValue }

export type ExtensionManifestOption = {
  key: string
  path: Array<string>
  label: string
  description?: string
  type: 'select' | 'boolean' | 'text' | 'number' | 'list'
  default?: JSONValue
  choices?: Array<{ label?: string; value: JSONValue }>
  trueValue?: JSONValue
  falseValue?: JSONValue
  item?: JSONValue
  itemCase?: 'upper'
}

export type ExtensionManifest = {
  $schema?: string
  kind: 'plugin' | 'adapter' | 'parser'
  name: string
  export: string
  displayName: string
  description: string
  category?: string
  icon?: { light: string; dark?: string }
  media?: Array<string>
  tags?: Array<string>
  docs?: string
  compatibility?: { kubb?: string; node?: string }
  role?: 'client' | 'consumer'
  options?: Array<ExtensionManifestOption>
}

/**
 * A reviewed record in `extensions/<owner>/<slug>.json`.
 */
export type RegistryRecord = {
  $schema?: string
  id: string
  artifact: { kind: 'npm'; package: string; version: string }
  repository: { url: string }
  submittedAt: string
  submittedBy: string
  publishedAt: string
  reviewedAt: string
  /** Reviewer-owned category slugs from `categories.json`. The first is the main one. */
  categories?: Array<string>
  /** Reviewer overrides applied over the manifest. */
  listing?: Partial<Pick<ExtensionManifest, 'displayName' | 'description' | 'tags' | 'icon'>>
}

/**
 * One extension in `index.json`.
 */
export type RegistryEntry = {
  id: string
  kind: ExtensionManifest['kind']
  type: 'official' | 'community'
  artifact: RegistryRecord['artifact']
  repository?: { url: string }
  manifest: ExtensionManifest
  stats?: { downloads?: number; weekly?: number; stars?: number }
  submittedAt: string
  publishedAt: string
  reviewedAt: string
}

/**
 * `<owner>/<slug>.json`.
 */
export type RegistryDetail = RegistryEntry & { overview: string | null }

export type RegistryIndex = { version: 1; generatedAt: string; extensions: Array<RegistryEntry> }

/** One entry of `categories.json`. */
export type RegistryCategory = { slug: string; label: string; description: string }
