# Registry protocol

The contract between a Kubb extension registry and its clients: the Kubb CLI, Kubb Studio, and kubb.dev. A registry is a set of static JSON documents under a base URL. Anyone can host one, for example an internal registry for a company's own plugins.

The default base URL is `https://kubb.dev/registry`. Point the CLI at another registry with `KUBB_REGISTRY=<base URL>`.

## Serving rules

- Documents are served as `application/json`, with CORS allowed.
- Documents are answered directly, never through a redirect.
- An unknown id answers 404.

## `GET <base>/index.json`

Every listed extension.

```ts
type RegistryIndex = { version: 1; generatedAt: string; extensions: Array<RegistryEntry> }

type RegistryEntry = {
  id: string // "kubb-labs/plugin-zod"
  kind: 'plugin' | 'adapter' | 'parser'
  type: 'official' | 'community'
  artifact: { kind: 'npm'; package: string; version: string }
  repository?: { url: string }
  manifest: ExtensionManifest // kubb-extension.json at the pinned version, with the record's categories and listing applied
  stats?: { downloads?: number; weekly?: number; stars?: number }
  submittedAt: string
  publishedAt: string
  reviewedAt: string
}
```

`ExtensionManifest` is the content of `kubb-extension.json` ([schema](schemas/kubb-extension.json)). `manifest.kind` always equals `kind`. Clients ignore keys they do not know, and reject an index whose `version` is not `1`.

## `GET <base>/<owner>/<slug>.json`

One extension: `RegistryEntry & { overview: string | null }`. `overview` is the Markdown of the author's `OVERVIEW.md` or the registry overview. It is untrusted content, so render it as plain Markdown without raw HTML.

## `GET <base>/categories.json`

The categories records may use: `Array<{ slug: string; label: string; description: string }>`.

## Host your own registry

Serve the same documents from any static host. To build them from your own records, fork this repository, replace `extensions/`, and run `pnpm build`. The output in `dist/` is the whole registry.
