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
  artifact: RegistryArtifact
  repository?: { url: string }
  manifest: ExtensionManifest // kubb-extension.json at the pinned version, with the record's categories and listing applied
  stats?: { downloads?: number; weekly?: number; stars?: number }
  changes?: RegistryChanges
  submittedAt: string
  publishedAt: string
  reviewedAt: string
}

type RegistryArtifact =
  | { kind: 'npm'; package: string; version: string }
  | { kind: 'github'; package: string; version: string; owner: string; repo: string; tag: string; commit: string }

type RegistryChanges = {
  summary: string // "Support Zod 4 only", the first entry of the version's changelog section
  breaking?: boolean // true when the section lists major changes
  guide?: string // a migration guide URL the section links to
}
```

`changes` is the headline change of the pinned version, read from the `CHANGELOG.md` in its package. It is plain text, without links, pull request references, or Markdown. An entry whose version ships no changelog, or no section for the version, leaves it out. A registry built before it existed leaves it out too, so read it as optional.

Install an `npm` artifact as `<package>@<version>`. Install a `github` artifact as `github:<owner>/<repo>#<commit>`, never by its tag. The package sits at the repository root, `package` is the `name` in its `package.json`, and `version` is the release version that `tag` names. Skip an entry whose `artifact.kind` you do not know.

`ExtensionManifest` is the content of `kubb-extension.json` ([schema](https://github.com/kubb-labs/kubb/blob/main/packages/core/schemas/kubb-extension.json), shipped in `@kubb/core`, which also exports the types). `manifest.kind` always equals `kind`. Clients ignore keys they do not know, and reject an index whose `version` is not `1`.

## `GET <base>/<owner>/<slug>.json`

One extension: its index entry plus the Markdown docs its pinned version ships.

```ts
type RegistryDetail = RegistryEntry & {
  overview: string | null
  options?: string | null
  guides?: Array<RegistryGuide>
}

type RegistryGuide = {
  id: string // "authentication", the file name without .md
  title: string // the first "# " heading
  description: string // the first paragraph after the title
  content: string // the whole Markdown file
}
```

- `overview` is the package's `docs/overview.md`. An npm version published before `docs/` may ship a root `OVERVIEW.md` instead. Without either, it is the registry's own overview, or `null`.
- `options` is the package's `docs/options.md`, or `null`.
- `guides` holds each `docs/guides/<id>.md`, sorted by file name, at most 50. `id` is kebab case. A version without guides has `[]`.
- This repository always writes `options` and `guides`. A registry built before they existed leaves them out, so read a missing `options` as `null` and a missing `guides` as `[]`.
- `index.json` leaves out `overview`, `options`, and `guides`.

### Render the Markdown

All Markdown in a detail comes from the package author, so it is untrusted. Render it as plain Markdown, and escape or drop raw HTML instead of rendering it. Each guide starts with a `# Title` line and a description paragraph. The overview and options page should too, but do not rely on it. Beyond plain Markdown, these render:

- Code fences with a language and an optional title, such as ` ```typescript [kubb.config.ts] `.
- The callouts `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, and `> [!WARNING]`.
- The components `::code-group`, `::field-group` with `:::field`, `::steps`, `::code-collapse`, and `::tabs` with `:::tabs-item`.

Validation reports raw HTML, `<!--@include`, twoslash code fences, and other components before a version is approved. Clients must still handle them. Show a component you do not support as plain Markdown.

## `GET <base>/categories.json`

The categories records may use: `Array<{ slug: string; label: string; description: string }>`.

## Host your own registry

Serve the same documents from any static host. To build them from your own records, fork this repository, replace `extensions/`, and run `pnpm build`. The output in `dist/` is the whole registry.
