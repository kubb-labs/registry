# Reviewing a registry pull request

Merging a record approves one exact version for everyone who runs `kubb add`. The checks cover what a script can verify. Your review covers the rest.

## How to review

1. Wait for **Validate** and **Load changed extensions** to pass. Submit and Bump start them. See [Validation](README.md#validation).
2. Open the package code in the browser:
   - npm: `https://www.npmjs.com/package/<package>/v/<version>?activeTab=code`
   - GitHub release: `https://github.com/<owner>/<repo>/tree/<commit>`
3. Work through the checklists below.
4. If an item fails, request changes and name the item. Otherwise, approve.
5. Merge when Validate passes on the `chore: approve records` commit.

> [!WARNING]
> Never install, build, or run the package yourself. A passing load check means the package loads, not that it is safe: its own code runs during the check.

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

`docs/overview.md` is the extension's page on kubb.dev.

- [ ] It opens with what the extension is and does, in one or two short paragraphs.
- [ ] It explains how it works only when that is not obvious.
- [ ] It lists the setup the extension needs: other plugins, peer packages.
- [ ] It explains options worth explaining and known limits.
- [ ] It uses sentence case, plain language, and no em dashes.
- [ ] It has no install commands, badges, changelog, license text, or marketing.

## Options and guides

Optional. Check `docs/options.md` and each `docs/guides/<id>.md` the package ships.

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

Approving runs the `Approve` workflow. It pushes a commit that sets `reviewedAt` on each changed record, and `publishedAt` on a new one, then starts Validate. The dates record when the version was approved.

> [!NOTE]
> Fork pull requests get no stamp commit, because their token is read-only. Submissions never come from forks.

## After merging

Deploy publishes the registry within minutes at `https://kubb.dev/registry`, and kubb.dev lists the extension after its redeploy. Each new version the weekly bump pins needs the same review.
