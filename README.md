# Kubb extension registry

The reviewed registry of Kubb plugins, adapters, and parsers behind [kubb.dev/extensions](https://kubb.dev/extensions), [Kubb Studio](https://kubb.studio), and the Kubb CLI (`kubb add`, `kubb update`, `kubb list`).

Each record pins one npm version. Merging a record approves that exact version. The [registry protocol](PROTOCOL.md) is the contract clients read, so anyone can host a registry by serving the same static JSON.

## Use the registry

kubb.dev clones this repository on every deploy, builds the records into static JSON with `pnpm build`, and serves the result at `https://kubb.dev/registry`, the base URL the CLI reads. The deploy workflow redeploys kubb.dev on every merge and once a day, so download and star counts stay current. Besides `index.json`, it serves `<owner>/<slug>.json` for one extension, `categories.json`, and the JSON Schemas under `schemas/`.

## Submit an extension

1. Publish the package to npm with a `kubb-extension.json` and an `OVERVIEW.md` at the package root, both listed in `files` in `package.json`. See [Publish a plugin](https://kubb.dev/docs/5.x/how-to/publish-a-plugin).
2. Open a [submission issue](https://github.com/kubb-labs/registry/issues/new?template=submit-extension.yml). In **Source**, paste the npm package name (optionally `name@version`), its npmjs.com page, or the GitHub URL of the repository or package folder. Tick the categories that fit. The first tick is the main one.
3. Intake opens a review pull request with the record. It pins the version you gave, or the npm `latest` version. Problems with the manifest or the overview are listed in the pull request for the reviewer, and do not stop intake.
4. A maintainer reviews the package against [REVIEW.md](REVIEW.md), completes the listing, stamps the approval with `pnpm approve`, and merges it.

Editing the issue runs intake again until a review pull request exists. After that, the reviewer owns the pull request and reads later edits from the issue.

Every week, a workflow opens one pull request that moves each pin to the npm `latest` version that passes validation.

## Records

A record lives at `extensions/<owner>/<slug>.json`:

- `<owner>` is the GitHub owner of the source repository, in lowercase.
- `<slug>` is the npm package name without its scope: `@kubb/plugin-zod` gives `plugin-zod`.
- Both match `[a-z0-9]+(?:-[a-z0-9]+)*`.

```json
{
  "$schema": "https://kubb.dev/schemas/registry-record.json",
  "id": "kubb-labs/plugin-zod",
  "artifact": { "kind": "npm", "package": "@kubb/plugin-zod", "version": "5.4.4" },
  "repository": { "url": "https://github.com/kubb-labs/plugins/tree/main/packages/plugin-zod" },
  "submittedAt": "2026-10-12T20:00:00Z",
  "submittedBy": "stijnvanhulle",
  "publishedAt": "2026-10-12T20:00:00Z",
  "reviewedAt": "2026-10-12T20:00:00Z",
  "categories": ["validation"]
}
```

| Field            | Written by | Meaning                                                                                                            |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `id`             | Bot        | `<owner>/<slug>`. Must equal the file path.                                                                        |
| `artifact`       | Bot        | The install pin: an exact npm version.                                                                             |
| `repository.url` | Bot        | The source on GitHub, optionally the package folder.                                                               |
| `submittedAt`    | Bot        | When the extension was submitted. Never changes.                                                                   |
| `publishedAt`    | Reviewer   | When the first version was approved, set by `pnpm approve`. Never changes after that.                              |
| `reviewedAt`     | Reviewer   | When the pinned version was approved, set by `pnpm approve` on every new pin.                                      |
| `categories`     | Reviewer   | Slugs from [`categories.json`](categories.json). The first is the main one and replaces the manifest's `category`. |
| `listing`        | Reviewer   | Optional overrides for `displayName`, `description`, `tags`, and `icon`.                                           |

Timestamps are UTC, to the second, such as `2026-10-12T20:00:00Z`. The JSON Schema is [`schemas/registry-record.json`](schemas/registry-record.json). A record owned by `kubb-labs` is `official`, every other record is `community`.

### Overviews

The overview is the extension's page on kubb.dev and its summary in Studio. The registry reads `OVERVIEW.md` from the pinned npm version. When that version ships none, it uses `extensions/<owner>/<slug>.md`, which the reviewer writes before approval. When a later version ships its own `OVERVIEW.md`, that one takes precedence and the bump removes the registry copy.

An overview explains, in this order and without fixed headings: what the extension does, how it works when that is not obvious, the setup it needs, and the options and limits worth knowing. It has no install commands, badges, changelog, license text, or marketing.

## Validation

Validation never installs, imports, or runs an extension. Files are read from the npm tarball of the pinned version, after checking it against the SHA-512 integrity npm publishes, and nothing is extracted to disk.

```sh
pnpm validate                                    # offline, every record
pnpm validate --changed --base origin/main       # plus the dates of changed records
pnpm validate --online --changed --base origin/main
```

Offline, for every record:

- The record matches the schema, and `id` equals its path, its package slug, and its repository owner.
- Every category is in `categories.json`, and no package has two records.
- Every registry overview belongs to a record and has no install commands.
- With `--changed`, `submittedAt` and `publishedAt` stay as they were at the merge base, and every date a change writes is a UTC timestamp to the second.

Online (`--online`), for the changed records or every record:

- The pinned npm version exists.
- `kubb-extension.json` at that version matches [`schemas/kubb-extension.json`](schemas/kubb-extension.json): `kind`, `name`, and `export` are present, `export` is a JavaScript identifier, and `compatibility` has only `kubb` and `node`.
- Option keys are unique, every `select` has `choices`, and a select's `default` equals one of its choice values.
- An overview exists, the author's `OVERVIEW.md` or the registry's `extensions/<owner>/<slug>.md`, and it has no install commands (`kubb add`, `npm install`, `npm i`, `pnpm add`, `yarn add`).

A community version must ship a manifest. An official version released before manifests may omit it. Its record stays valid, but the build leaves it out of the index until a bump pins a version that ships one.

The `Validate` workflow runs the online check on changed records. Pull requests opened by the registry workflows use the default `GITHUB_TOKEN`, so they do not trigger it; run the command above, or re-run the check from the pull request.

## Workflows

| Workflow                                   | When                         | What it does                                                                               |
| ------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------ |
| [Validate](.github/workflows/validate.yml) | Pull requests                | Type checks, lints, tests, and validates every record offline and the changed ones online. |
| [Submit](.github/workflows/submit.yml)     | A `submission` issue changes | Writes the record and opens the review pull request.                                       |
| [Bump](.github/workflows/bump.yml)         | Mondays                      | Opens one pull request that moves pins to npm `latest`.                                    |
| [Deploy](.github/workflows/deploy.yml)     | Pushes to `main`, and daily  | Redeploys kubb.dev, which builds and serves the registry.                                  |

## Development

Requires Node.js 22.18 or later, which runs the TypeScript scripts directly, and pnpm.

```sh
pnpm install
pnpm build       # writes dist/ from the records and their pinned npm versions
pnpm approve     # stamps the changed records as approved now, before merging
pnpm test
pnpm typecheck
pnpm lint
pnpm format
```

kubb.dev runs `scripts/build.ts` from its own checkout without installing this repository's packages, so the build resolves `ajv` and `ajv-formats` from kubb.dev. Keep the build to those packages, or add a new one to kubb.dev first.
