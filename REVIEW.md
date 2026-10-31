# Reviewing a registry pull request

Merging a record approves one exact version, an npm version or a GitHub release's commit, for everyone who runs `kubb add`. Check each item before you approve. When an item fails, request changes on the pull request and say which item.

`pnpm validate --online --changed` checks the record, the dates, the version on npm or GitHub, the manifest, and the docs (see [README.md](README.md#validation)). Bot pull requests do not trigger the `Validate` check, so run it yourself. Your review covers what a script cannot judge.

The `Load the extension` job in `Submit` installs the pinned version with `--ignore-scripts`, in a job with no token, and comments on the review pull request whether the manifest's `export` loads with the right `meta.name`. Beyond that, inspect the package without running it. Read its files from the npm tarball (`npm view <package>@<version> dist.tarball`), check them against `dist.integrity`, and never run `npm install`, a build, or a lifecycle script inside it. For a GitHub release, read the archive of the pinned commit (`https://codeload.github.com/<owner>/<repo>/tar.gz/<commit>`) instead.

## Listing

- [ ] `categories` holds every category that fits, from `categories.json`, with the main one first.
- [ ] The package ships `docs/overview.md` (or a root `OVERVIEW.md` in a version published before `docs/`), or you wrote `extensions/<owner>/<slug>.md` from its README and source.

## Identity

- [ ] The record owner matches the repository owner, and `id` is `<owner>/<slug>`.
- [ ] The submitter (`submittedBy`) is the repository owner, or a member of the owning organization.
- [ ] For npm: the package lists the same repository in its `package.json` `repository` field.
- [ ] For npm: the maintainers are the people or the organization behind the repository.

## Package and version

- [ ] For npm: the package and the pinned version exist, and the version is not deprecated.
- [ ] For npm: the published code matches the repository at the tag or commit for that version.
- [ ] For GitHub: the committed build matches the source at the pinned commit. Users run the build, so read it, not only the source.
- [ ] The package declares `kubb` or `@kubb/core` as a peer dependency, not a bundled copy.

## Manifest

- [ ] `kubb-extension.json` is valid: `kind`, `name`, `export`, `displayName`, and `description` are set, and `compatibility` uses only `kubb` and `node`.
- [ ] `export` is a factory the package exports from its entry point.
- [ ] `name` equals the extension's `meta.name`.
- [ ] Icons and media are HTTPS URLs that load and show the extension, not unrelated content.
- [ ] Each option in `options` edits a real option of the factory, with a correct `path` and `default`.

## Overview

`docs/overview.md` is the extension's page on kubb.dev. Check each item:

- [ ] It opens with what the extension is and does, in one or two short paragraphs.
- [ ] It explains how it works only when that is not obvious.
- [ ] It lists the setup the extension needs: other plugins, peer packages.
- [ ] It explains options worth explaining and known limits.
- [ ] It uses sentence case, plain language, and no em dashes.
- [ ] It has no install commands, badges, changelog, license text, or marketing.

## Options and guides

`docs/options.md` and `docs/guides/<id>.md` are optional. When the package ships them, read each one:

- [ ] The options page documents the factory's real options, with the names and defaults the code and the manifest use.
- [ ] Each guide solves one task, and its first paragraph says what the reader gets.
- [ ] Code examples match the API of the pinned version.
- [ ] Links are absolute and point where their text says. Images use `https://` sources.
- [ ] They use sentence case and plain language, and have no badges, tracking links, marketing, or unrelated content.

## Install and runtime behavior

- [ ] The package has no `preinstall`, `install`, or `postinstall` script, or the script does only what its name and the overview say.
- [ ] The generator writes only inside the configured output path.
- [ ] Any network access is explained in the overview, along with what is sent and where.
- [ ] Any permission the extension needs, such as reading environment variables or files outside the spec, is explained in the overview.

## Approve

When every item passes, run `pnpm approve` on the pull request branch, push the commit, and merge. It sets `reviewedAt` on each changed record to now, and `publishedAt` too on a new one, so the dates say when the version was approved rather than when intake or the bump wrote the record.

## After merging

The deploy workflow publishes the registry within minutes, and `https://kubb.dev/registry` serves it right away. The catalog on kubb.dev lists the extension after the redeploy that the workflow asks for. The weekly bump pull request moves its pin to each new `latest` version, and each of those versions needs the same review.
