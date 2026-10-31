# Reviewing a registry pull request

Merging a record approves one exact version for everyone who runs `kubb add`. The checks cover what a script can verify, and you cover the rest.

## How to review

1. Wait for the Validate and Load changed extensions checks to pass. See [Validation](README.md#validation).
2. Open the package code in the browser:
   - npm: `https://www.npmjs.com/package/<package>/v/<version>?activeTab=code`
   - GitHub release: `https://github.com/<owner>/<repo>/tree/<commit>`
3. Work through the checklists below.
4. If an item fails, request changes and name the item. Otherwise, approve.
5. The Approve workflow pushes a `chore: approve records` commit that sets `reviewedAt` (and `publishedAt` on a new record). Merge when Validate passes on it.

> [!WARNING]
> Read the package in the browser instead of installing, building, or running it. The load check runs the package's own code, so a pass only shows that it loads.

## Listing

- [ ] `categories` holds every category that fits, from `categories.json`, with the main one first.
- [ ] The package ships `docs/overview.md` (or an older root `OVERVIEW.md`), or you wrote `extensions/<owner>/<slug>.md`.

## Identity

- [ ] The record owner matches the repository owner, and `id` is `<owner>/<slug>`.
- [ ] `submittedBy` owns the repository or belongs to its organization.
- [ ] For npm: `package.json` names the same repository, and the npm maintainers are the people behind it.

## Package and version

- [ ] For npm: the pinned version exists, is not deprecated, and matches the repository at its tag or commit.
- [ ] For GitHub: the committed build, which users run, matches the source at the pinned commit.
- [ ] `kubb` or `@kubb/core` is a peer dependency, not bundled.

## Manifest

- [ ] `kubb-extension.json` is valid: `kind`, `name`, `export`, `displayName`, and `description` are set, and `compatibility` uses only `kubb` and `node`.
- [ ] `export` is a factory from the entry point, and `name` equals its `meta.name`.
- [ ] Icons and media are HTTPS URLs that load and show the extension.
- [ ] Each entry in `options` maps to a real factory option, with the right `path` and `default`.

## Overview

`docs/overview.md` is the extension's page on kubb.dev.

- [ ] It opens with what the extension does, in one or two short paragraphs, and explains how only when that is not obvious.
- [ ] It lists the setup it needs (other plugins, peer packages), the options that need explaining, and known limits.
- [ ] It uses sentence case, plain language, and no em dashes.
- [ ] It has no install commands, badges, changelog, license text, or marketing.

## Options and guides

Optional. Check `docs/options.md` and each `docs/guides/<id>.md` the package ships.

- [ ] The options page matches the factory's real options, names, and defaults.
- [ ] Each guide solves one task, says what the reader gets in its first paragraph, and uses the pinned version's API.
- [ ] They use sentence case and plain language, absolute and accurate links, and `https://` images, with no badges, tracking links, marketing, or unrelated content.

## Install and runtime behavior

- [ ] Any `preinstall`, `install`, or `postinstall` script does only what the overview says.
- [ ] The generator writes only inside the configured output path.
- [ ] The overview explains any network access (what is sent, and where) and any other access, such as environment variables or files outside the spec.

> [!NOTE]
> Fork pull requests get no stamp commit, because their token is read-only. Submissions never come from forks.

After the merge, Deploy publishes `https://kubb.dev/registry` within minutes. Each version the weekly bump pins gets the same review.
