# Redoc

Generates a single HTML page that documents your OpenAPI spec with Redoc. The page is rebuilt on every Kubb run, so the docs always match the spec your code comes from.

The spec is embedded in the page, so you can publish it to any static host without a build step. Viewing the page needs network access, because Redoc's scripts and fonts load from a CDN.

## Setup

No other plugins or packages are needed.

## Options worth knowing

- `output.path` is the path of the HTML file. The default is `docs.html`. It points at a file, not a folder, so end it with `.html`.

The plugin takes no other options.
