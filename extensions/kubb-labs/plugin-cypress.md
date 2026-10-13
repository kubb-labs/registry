# Cypress

Generates a typed `cy.request()` helper for each operation in your OpenAPI spec. Your Cypress tests call the API through these helpers, so a broken call fails at compile time instead of at run time.

Each helper takes grouped `path`, `query`, `headers`, and `body` parameters and returns the typed response body.

## Setup

- Add `@kubb/plugin-ts` for the request and response types.
- The generated helpers need Cypress v13 or higher.

## Options worth knowing

- `baseURL` is prepended to every request.
