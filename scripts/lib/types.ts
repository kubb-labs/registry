import type { ExtensionManifest } from '@kubb/core'

/**
 * Types for the registry's own files. The manifest and protocol types come from `@kubb/core`.
 */

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

/** One entry of `categories.json`. */
export type RegistryCategory = { slug: string; label: string; description: string }
