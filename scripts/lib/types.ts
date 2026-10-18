import type { ExtensionManifest, RegistryArtifact } from '@kubb/core'

/**
 * Types for the registry's own files. The manifest and protocol types come from `@kubb/core`.
 */

/**
 * A reviewed record in `extensions/<owner>/<slug>.json`.
 */
export type RegistryRecord = {
  $schema?: string
  id: string
  artifact: RegistryArtifact
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

/** A pin to a GitHub release: the tag and the commit it points to, at the repository root. */
export type GitHubArtifact = Extract<RegistryArtifact, { kind: 'github' }>

/** One entry of `categories.json`. */
export type RegistryCategory = { slug: string; label: string; description: string }

/** The headline change of a pinned version, from its `CHANGELOG.md`. Replace with `RegistryChanges` from `@kubb/core` once the pinned release exports it. */
export type RegistryChanges = { summary: string; breaking?: boolean; guide?: string }
