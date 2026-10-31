<div align="center">
  <a href="https://kubb.dev" target="_blank" rel="noopener noreferrer">
    <img src="https://kubb.dev/og.png" alt="Kubb banner">
  </a>
</div>

# Kubb extension registry

The reviewed list of Kubb plugins, adapters, and parsers behind [kubb.dev/extensions](https://kubb.dev/extensions), [Kubb Studio](https://kubb.studio), and `kubb add`. Each record pins one exact version. Clients read it through the [registry protocol](PROTOCOL.md).

## Submit an extension

### Before you submit

Your package needs:

- A version on npm, or a [GitHub release](#from-github).
- `kubb-extension.json` at the package root, naming the factory users call, such as `pluginGraphql`. See [Publish a plugin](https://kubb.dev/docs/5.x/how-to/publish-a-plugin).
- `docs/overview.md`, plus optional `docs/options.md` and `docs/guides/`. See [Extension docs](https://kubb.dev/docs/5.x/reference/kit/extension-docs).
- `kubb` or `@kubb/core` as a peer dependency, and a `repository` field that points to GitHub.
- No install scripts, or only ones the overview explains.
- A GitHub repository you own, or one owned by an organization you belong to.

Reviewers check the same list in [REVIEW.md](REVIEW.md).

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

1. Within minutes, a bot comments with a link to the review pull request. If it reports a problem instead, fix it and edit the issue to run intake again.
2. Checks on the pull request validate the record and docs, and load your extension with install scripts off.
3. A maintainer reviews it against [REVIEW.md](REVIEW.md) and asks for changes in the pull request if needed.
4. After the merge, the extension is listed. Each Monday, a bump pull request moves the pin to your newest version, which gets the same review.

### From GitHub

A package that is not on npm installs from a GitHub release, as `github:<owner>/<repo>#<commit>`. The release needs:

- The package at the repository root. A scoped name uses the owner as scope, such as `@acme/...` for `github.com/acme`.
- A tag equal to the `package.json` version, with or without a leading `v`.
- Committed build files, with `main`, `module`, and `exports` pointing to them, and `files` listing them and `kubb-extension.json`.
- No `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, `prepublish`, `publish`, or `build` script, and no `workspaces`.

Submit the repository URL, or add a tag to pin an older release.

## Records

A record lives at `extensions/<owner>/<slug>.json`, from the repository owner and the unscoped package name in kebab case. `kind` and `category` are reserved owners.

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

| Field            | Set by   | Meaning                                                              |
| ---------------- | -------- | -------------------------------------------------------------------- |
| `id`             | Bot      | `<owner>/<slug>`, equal to the file path.                            |
| `artifact`       | Bot      | The pinned npm version, or GitHub tag and commit.                    |
| `repository.url` | Bot      | The source on GitHub.                                                |
| `submittedAt`    | Bot      | When it was submitted. Never changes.                                |
| `publishedAt`    | Reviewer | When the first version was approved. Never changes.                  |
| `reviewedAt`     | Reviewer | When the pinned version was approved.                                |
| `categories`     | Reviewer | Slugs from [`categories.json`](categories.json), main first.         |
| `listing`        | Reviewer | Optional `displayName`, `description`, `tags`, and `icon` overrides. |

A GitHub record pins a release tag and commit instead, as in the [protocol](PROTOCOL.md#get-baseindexjson). Timestamps are UTC to the second. Records owned by `kubb-labs` are `official`, all others `community`. See the [record schema](schemas/registry-record.json).

> [!NOTE]
> If a version ships no `docs/overview.md` (or older root `OVERVIEW.md`), the reviewer writes one at `extensions/<owner>/<slug>.md`. A bump to a version with its own overview deletes it.

## Validation

```sh
pnpm validate                                        # every record, offline
pnpm validate --online --changed --base origin/main  # changed records, against npm and GitHub
```

Offline, it checks each record against its schema, path, and `categories.json`, and that no two records share a package. With `--changed`, it also checks that `submittedAt` and `publishedAt` did not move.

Online, it checks that the pinned version exists and that its manifest and docs match the [manifest schema](https://github.com/kubb-labs/kubb/blob/main/packages/core/schemas/kubb-extension.json) and [Extension docs](https://kubb.dev/docs/5.x/reference/kit/extension-docs). For a GitHub release, it also checks the [From GitHub](#from-github) rules, that the tag still points to the commit, and that npm does not list the name.

`pnpm validate` only reads tarballs. The Load changed extensions job in the Validate workflow runs each changed extension, with no token and install scripts off. Set `GITHUB_TOKEN` to raise GitHub's limit of 60 requests an hour.

> [!NOTE]
> A community version must ship a manifest. An official version from before manifests may omit it, and stays out of the index until a bump pins one that has it.

## Workflows

| Workflow                                   | Runs on                                | Does                                                         |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------------------------ |
| [Submit](.github/workflows/submit.yml)     | A `submission` or `submit:` issue      | Writes the record and opens the review pull request.         |
| [Validate](.github/workflows/validate.yml) | Pull requests, pushes, other workflows | Checks code and records, and loads changed extensions.       |
| [Approve](.github/workflows/approve.yml)   | An approving review                    | Stamps the approved records.                                 |
| [Bump](.github/workflows/bump.yml)         | Mondays, plugins releases              | Opens a pull request that moves pins to the newest versions. |
| [Deploy](.github/workflows/deploy.yml)     | Pushes to `main`, daily                | Publishes to GitHub Pages and redeploys kubb.dev.            |

## Development

Requires pnpm and Node.js 22.18 or later.

```sh
pnpm install
pnpm build       # writes dist/ from the records
pnpm approve     # stamps changed records (the Approve workflow runs this)
pnpm test
pnpm typecheck
pnpm lint
pnpm format
```
