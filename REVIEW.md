# Reviewing a registry pull request

Merging a record approves one exact npm version for everyone who runs `kubb add`. Check each item before you approve. When an item fails, request changes on the pull request and say which item.

`pnpm validate --online --changed` checks the record, the dates, the version on npm, the manifest, and the overview (see [README.md](README.md#validation)). Bot pull requests do not trigger the `Validate` check, so run it yourself. Your review covers what a script cannot judge.

Inspect the package without running it. Read its files from the npm tarball (`npm view <package>@<version> dist.tarball`), check them against `dist.integrity`, and never run `npm install`, a build, or a lifecycle script inside it.

## Listing

- [ ] `categories` holds every category that fits, from `categories.json`, with the main one first.
- [ ] The package ships `OVERVIEW.md`, or you wrote `extensions/<owner>/<slug>.md` from its README and source.

## Identity

- [ ] The record owner matches the repository owner, and `id` is `<owner>/<slug>`.
- [ ] The submitter (`submittedBy`) is the repository owner, or a member of the owning organization.
- [ ] The npm package lists the same repository in its `package.json` `repository` field.
- [ ] The npm maintainers are the people or the organization behind the repository.

## Package and version

- [ ] The package and the pinned version exist on npm, and the version is not deprecated.
- [ ] The published code matches the repository at the tag or commit for that version.
- [ ] The package declares `kubb` or `@kubb/core` as a peer dependency, not a bundled copy.

## Manifest

- [ ] `kubb-extension.json` is valid: `kind`, `name`, `export`, `displayName`, and `description` are set, and `compatibility` uses only `kubb` and `node`.
- [ ] `export` is a factory the package exports from its entry point.
- [ ] `name` equals the extension's `meta.name`.
- [ ] Icons and media are HTTPS URLs that load and show the extension, not unrelated content.
- [ ] Each option in `options` edits a real option of the factory, with a correct `path` and `default`.

## Overview

`OVERVIEW.md` is the extension's page on kubb.dev. It follows this content contract:

- [ ] It opens with what the extension is and does, in one or two short paragraphs.
- [ ] It explains how it works only when that is not obvious.
- [ ] It lists the setup the extension needs: other plugins, peer packages.
- [ ] It explains options worth explaining and known limits.
- [ ] It uses sentence case, plain language, and no em dashes.
- [ ] It has no install commands, badges, changelog, license text, or marketing.

## Install and runtime behavior

- [ ] The package has no `preinstall`, `install`, or `postinstall` script, or the script does only what its name and the overview say.
- [ ] The generator writes only inside the configured output path.
- [ ] Any network access is explained in the overview, along with what is sent and where.
- [ ] Any permission the extension needs, such as reading environment variables or files outside the spec, is explained in the overview.

## After merging

The publish workflow lists the extension within minutes: on GitHub Pages, at `https://kubb.dev/registry`, and in the next `@kubb/registry` npm release. kubb.dev's catalog shows it after its next deploy. The weekly bump pull request moves its pin to each new `latest` version, and each of those versions needs the same review.
