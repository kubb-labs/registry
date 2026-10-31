<div align="center">
  <a href="https://kubb.dev" target="_blank" rel="noopener noreferrer">
    <img src="https://kubb.dev/og.png" alt="Kubb banner">
  </a>
</div>

# Kubb extension registry

The reviewed list of Kubb plugins, adapters, and parsers behind [kubb.dev/extensions](https://kubb.dev/extensions), [Kubb Studio](https://kubb.studio), and `kubb add`. Each record pins one exact version, and merging a record approves it.

> [!TIP]
> Clients read the registry through the [registry protocol](PROTOCOL.md). Anyone can host their own by serving the same static JSON.

## Submit an extension

### Before you submit

Your package needs:

- A version on npm, or a [GitHub release](#from-github).
- `kubb-extension.json` at the package root, naming the factory users call, such as `pluginGraphql`. See [Publish a plugin](https://kubb.dev/docs/5.x/how-to/publish-a-plugin).
- `docs/overview.md`, plus optional `docs/options.md` and `docs/guides/`. See [Extension docs](https://kubb.dev/docs/5.x/reference/kit/extension-docs).
- `kubb` or `@kubb/core` as a peer dependency, and a `repository` field that points to GitHub.
- No install scripts, or only ones the overview explains.

You must own the GitHub repository, or be a member of the organization that owns it. Reviewers check this same list in [REVIEW.md](REVIEW.md).

### Submit

1. Open a [submission issue](https://github.com/kubb-labs/registry/issues/new?template=submit-extension.yml).
2. In **Source**, enter one of these:

   | You have                              | Enter                                                             |
   | ------------------------------------- | ----------------------------------------------------------------- |
   | An npm package (pins `latest`)        | `@acme/kubb-plugin-graphql`                                       |
   | A specific npm version                | `@acme/kubb-plugin-graphql@1.2.3`                                 |
   | An npm page                           | `https://www.npmjs.com/package/@acme/kubb-plugin-graphql`         |
   | A package folder in a GitHub monorepo | `https://github.com/acme/kubb-plugins/tree/main/packages/graphql` |
   | A GitHub release, package not on npm  | `https://github.com/acme/kubb-plugin-graphql/tree/v1.2.0`         |

3. Tick every category that fits. The first tick is the main one.
4. Submit the issue.

### What happens next

1. Within minutes, a bot comments with a link to the review pull request, or with what to fix.
2. Checks on the pull request validate the record and docs, and load your extension with install scripts off.
3. A maintainer reviews it against [REVIEW.md](REVIEW.md) and asks for changes in the pull request if needed.
4. After the merge, the extension is listed. Each Monday, a bump pull request moves the pin to your newest version, which gets the same review.

> [!TIP]
> If the bot reports a problem, fix it and edit the issue. Intake runs again until the review pull request exists.

### From GitHub

A package that is not on npm can install from a GitHub release, as `github:<owner>/<repo>#<commit>`. The release must meet these rules:

- The package sits at the repository root. A scoped name uses the owner as its scope: `@acme/...` for `github.com/acme`.
- The release tag is the `package.json` version, with or without a leading `v`.
- The built files are committed, and `main`, `module`, and `exports` point to them.
- `files` in `package.json` lists the build and `kubb-extension.json`.
- There is no `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, `prepublish`, `publish`, or `build` script, and no `workspaces`.

Submit the repository URL. Add a tag to pin an older release: `https://github.com/acme/kubb-plugin-x/tree/v1.2.0`.

## Records

A record lives at `extensions/<owner>/<slug>.json`: the repository owner and the package name without its scope, both in kebab case. `kind` and `category` are reserved owners.

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

A GitHub record pins the release, and its `repository.url` is the repository root:

```json
"artifact": { "kind": "github", "package": "@acme/kubb-plugin-x", "version": "1.2.0", "owner": "acme", "repo": "kubb-plugin-x", "tag": "v1.2.0", "commit": "<full commit SHA>" }
```

Timestamps are UTC to the second. Records owned by `kubb-labs` are `official`, all others `community`. See the [record schema](schemas/registry-record.json).

> [!NOTE]
> A version without `docs/overview.md` (or a root `OVERVIEW.md` from before `docs/`) gets an overview the reviewer writes at `extensions/<owner>/<slug>.md`. The bump to a version with its own overview deletes it.

## Validation

```sh
pnpm validate                                        # every record, offline
pnpm validate --online --changed --base origin/main  # changed records, against npm and GitHub
```

- **Offline**: each record matches its schema, its path, and `categories.json`, and no two records share a package. With `--changed`, `submittedAt` and `publishedAt` did not move.
- **Online**: the pinned version exists, its `kubb-extension.json` matches the [manifest schema](https://github.com/kubb-labs/kubb/blob/main/packages/core/schemas/kubb-extension.json), and its docs follow [Extension docs](https://kubb.dev/docs/5.x/reference/kit/extension-docs).
- **GitHub releases**: also the [From GitHub](#from-github) rules, the tag still points to the pinned commit, and npm does not list the name.

`pnpm validate` reads tarballs and never runs an extension. The **Load changed extensions** job in the Validate workflow does, with no token and install scripts off. Set `GITHUB_TOKEN` to raise GitHub's limit of 60 requests an hour.

> [!NOTE]
> A community version must ship a manifest. An official version from before manifests may omit it, but stays out of the index until a bump pins one that ships it.

## Workflows

| Workflow                                   | Runs on                                 | Does                                                                               |
| ------------------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------- |
| [Submit](.github/workflows/submit.yml)     | A `submission` or `submit:` issue       | Writes the record, opens the review pull request, and starts Validate on it.       |
| [Validate](.github/workflows/validate.yml) | Pull requests, pushes, Submit and Bump  | Checks the code and records, and loads changed extensions in a job with no token.  |
| [Approve](.github/workflows/approve.yml)   | An approving review                     | Stamps the approved records, pushes the commit, and starts Validate.               |
| [Bump](.github/workflows/bump.yml)         | Mondays, and kubb-labs/plugins releases | Opens one pull request that moves pins to the newest version, and starts Validate. |
| [Deploy](.github/workflows/deploy.yml)     | Pushes to `main`, and daily             | Publishes the build to GitHub Pages and redeploys kubb.dev.                        |

## Development

Requires pnpm and Node.js 22.18 or later.

```sh
pnpm install
pnpm build       # writes dist/ from the records
pnpm approve     # stamps changed records; Approve runs it on approval
pnpm test
pnpm typecheck
pnpm lint
pnpm format
```
