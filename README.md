<div align="center">
  <a href="https://kubb.dev" target="_blank" rel="noopener noreferrer">
    <img src="https://kubb.dev/og.png" alt="Kubb banner">
  </a>
</div>

# Kubb extension registry

The reviewed registry of Kubb plugins, adapters, and parsers behind [kubb.dev/extensions](https://kubb.dev/extensions), [Kubb Studio](https://kubb.studio), and the Kubb CLI (`kubb add`, `kubb update`, `kubb list`).

Each record pins one npm version, or one GitHub release and its commit. Merging a record approves that exact version. The Deploy workflow builds the records with `pnpm build` and publishes the result to GitHub Pages, which kubb.dev serves at `https://kubb.dev/registry`. Clients read it through the [registry protocol](PROTOCOL.md), so anyone can host a registry by serving the same static JSON.

## Submit an extension

Anyone can submit a Kubb plugin, adapter, or parser. After a maintainer approves it, the extension is listed on [kubb.dev/extensions](https://kubb.dev/extensions) and in Kubb Studio, and users can install it with `kubb add`.

### Before you submit

Check that your package meets these requirements. A maintainer checks the same list in [REVIEW.md](REVIEW.md).

- The package is published on npm. A package that is not on npm can use a GitHub release instead, see [From GitHub](#from-github).
- `kubb-extension.json` sits at the package root and names the factory users call, such as `pluginGraphql`. See [Publish a plugin](https://kubb.dev/docs/5.x/how-to/publish-a-plugin).
- `docs/overview.md` describes what the extension does. `docs/options.md` and `docs/guides/` are optional. See [Extension docs](https://kubb.dev/docs/5.x/reference/kit/extension-docs).
- `package.json` lists `kubb` or `@kubb/core` as a peer dependency, and its `repository` field points to the GitHub repository.
- You own that GitHub repository, or you are a member of the organization that owns it.
- The package has no install scripts, or they do only what the overview says.

### Open a submission issue

Open a [submission issue](https://github.com/kubb-labs/registry/issues/new?template=submit-extension.yml) and fill in the form:

- **Source**: where the package lives. Use one of these formats:

  | You have                                 | Enter                                                             |
  | ---------------------------------------- | ----------------------------------------------------------------- |
  | An npm package (pins npm `latest`)       | `@acme/kubb-plugin-graphql`                                       |
  | A specific npm version                   | `@acme/kubb-plugin-graphql@1.2.3`                                 |
  | An npm page                              | `https://www.npmjs.com/package/@acme/kubb-plugin-graphql`         |
  | A package folder in a GitHub monorepo    | `https://github.com/acme/kubb-plugins/tree/main/packages/graphql` |
  | A GitHub release of a package not on npm | `https://github.com/acme/kubb-plugin-graphql/tree/v1.2.0`         |

- **Categories**: tick every category that fits. The first tick is the main one.
- **Notes**: anything the reviewer should know.

### What happens next

1. Within a few minutes, a bot comments on your issue with a link to the review pull request. If your submission has a problem, the bot comments what to fix instead. Edit the issue to try again.
2. A maintainer reviews the package against [REVIEW.md](REVIEW.md) and asks for changes in the pull request when something is missing.
3. After the pull request merges, the extension is listed. Each Monday, a bump pull request moves the pin to your newest version, and a maintainer reviews that version too.

### From GitHub

A package that npm does not list can install from a GitHub release. `kubb add` then installs `github:<owner>/<repo>#<commit>`. Validation checks that the release meets these rules:

- The package sits at the repository root. A scoped name uses the owner as its scope: `@acme/...` for `github.com/acme`.
- The release tag is the `package.json` version, with or without a leading `v`.
- The built files are committed, and `main`, `module`, and `exports` point to them.
- `files` in `package.json` lists the build and `kubb-extension.json`.
- There is no `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, `prepublish`, `publish`, or `build` script, and no `workspaces`. These make package managers build the package at install.

Submit the repository URL. To pin a release other than the latest, add its tag: `https://github.com/acme/kubb-plugin-x/tree/v1.2.0`.

## Records

A record lives at `extensions/<owner>/<slug>.json`. `<owner>` is the GitHub owner of the source repository in lowercase, and `<slug>` is the package name without its scope. Both are kebab case. `kind` and `category` are reserved owners, since kubb.dev uses them for its filter pages.

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

| Field            | Written by | Meaning                                                                                              |
| ---------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| `id`             | Bot        | `<owner>/<slug>`, equal to the file path.                                                            |
| `artifact`       | Bot        | The exact npm version to install, or a GitHub release tag and its commit.                            |
| `repository.url` | Bot        | The source on GitHub, optionally the package folder.                                                 |
| `submittedAt`    | Bot        | When the extension was submitted. Never changes.                                                     |
| `publishedAt`    | Reviewer   | When the first version was approved. Never changes.                                                  |
| `reviewedAt`     | Reviewer   | When the pinned version was approved.                                                                |
| `categories`     | Reviewer   | Slugs from [`categories.json`](categories.json), main one first. Replaces the manifest's `category`. |
| `listing`        | Reviewer   | Optional overrides for `displayName`, `description`, `tags`, and `icon`.                             |

A GitHub record pins the release instead, and its `repository.url` is the repository root:

```json
"artifact": { "kind": "github", "package": "@acme/kubb-plugin-x", "version": "1.2.0", "owner": "acme", "repo": "kubb-plugin-x", "tag": "v1.2.0", "commit": "<full commit SHA>" }
```

Timestamps are UTC to the second. Records owned by `kubb-labs` are `official`, all others are `community`. The schema is [`schemas/registry-record.json`](schemas/registry-record.json).

If the pinned version ships neither `docs/overview.md` nor a root `OVERVIEW.md` (from before `docs/` existed), the reviewer writes `extensions/<owner>/<slug>.md`. The bump to a version with its own overview deletes that file.

## Validation

Validation reads files from the npm tarball after checking its integrity, or from the archive GitHub serves for a release's commit. It never installs, imports, or runs an extension.

```sh
pnpm validate                                        # every record, offline
pnpm validate --online --changed --base origin/main  # changed records, against npm and GitHub
```

Offline, it checks every record against its schema, its path, and `categories.json`. No two records may share a package. With `--changed`, it also checks that `submittedAt` and `publishedAt` did not move. Online, it checks that the pinned version exists, that its `kubb-extension.json` matches the [manifest schema](https://github.com/kubb-labs/kubb/blob/main/packages/core/schemas/kubb-extension.json), and that its docs follow [Extension docs](https://kubb.dev/docs/5.x/reference/kit/extension-docs). For a GitHub release, it also checks the rules in [From GitHub](#from-github), that the tag still points to the pinned commit, and that npm does not list the name. Set `GITHUB_TOKEN` to raise GitHub's limit of 60 requests an hour.

A community version must ship a manifest. An official version released before manifests may omit it, but the build leaves it out of the index until a bump pins a version that ships one.

Pull requests the registry workflows open do not trigger the `Validate` check. Run the online command yourself, or re-run the check from the pull request.

## Workflows

| Workflow                                   | When                                           | What it does                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Validate](.github/workflows/validate.yml) | Pull requests                                  | Type checks, lints, tests, and validates every record offline and the changed ones online.                                                       |
| [Submit](.github/workflows/submit.yml)     | A `submission` issue changes                   | Writes the record and opens the review pull request.                                                                                             |
| [Bump](.github/workflows/bump.yml)         | Mondays, and after a kubb-labs/plugins release | Opens one pull request that moves pins to npm `latest` or the latest GitHub release. A plugins release bumps only the kubb-labs/plugins records. |
| [Deploy](.github/workflows/deploy.yml)     | Pushes to `main`, and daily                    | Publishes the build to GitHub Pages and redeploys kubb.dev.                                                                                      |

## Development

Requires pnpm and Node.js 22.18 or later, which runs the TypeScript scripts directly.

```sh
pnpm install
pnpm build       # writes dist/ from the records and their pinned versions
pnpm approve     # stamps the changed records as approved, before merging
pnpm test
pnpm typecheck
pnpm lint
pnpm format
```
