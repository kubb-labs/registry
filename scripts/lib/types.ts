/**
 * Types for the extension registry (see schemas/kubb-extension.json and schemas/registry-record.json).
 * `ExtensionManifest`, `RegistryEntry`, `RegistryDetail`, and `RegistryIndex` mirror the types
 * `@kubb/core` exports, so the registry needs no Kubb dependency.
 */

export type JSONValue = string | number | boolean | null | Array<JSONValue> | { [key: string]: JSONValue }

export type ExtensionKind = 'plugin' | 'adapter' | 'parser'

export type ExtensionIcon = { light: string; dark?: string }

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
  kind: ExtensionKind
  name: string
  export: string
  displayName: string
  description: string
  category?: string
  icon?: ExtensionIcon
  media?: Array<string>
  tags?: Array<string>
  docs?: string
  compatibility?: { kubb?: string; node?: string }
  role?: 'client' | 'consumer'
  options?: Array<ExtensionManifestOption>
}

/**
 * Reviewer overrides a record applies over the manifest.
 */
export type RegistryListing = Partial<Pick<ExtensionManifest, 'displayName' | 'description' | 'tags' | 'icon'>>

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
  listing?: RegistryListing
}

/**
 * One extension in `index.json`.
 */
export type RegistryEntry = {
  id: string
  kind: ExtensionKind
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
