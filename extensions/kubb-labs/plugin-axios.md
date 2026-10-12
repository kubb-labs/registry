# Axios

Generates a type-safe HTTP client based on axios from your OpenAPI spec. Each operation becomes one async function with grouped `path`, `query`, `headers`, and `body` parameters and a result keyed by status code.

This plugin provides the client runtime. Query plugins such as `@kubb/plugin-react-query`, `@kubb/plugin-vue-query`, `@kubb/plugin-swr`, and `@kubb/plugin-mcp` call the functions it generates.

## Setup

- Add `@kubb/plugin-ts` for the operation types. Without it, `@kubb/plugin-zod` with `inferred: true` supplies them.
- Add `@kubb/plugin-zod` when you set `validator`.
- Install axios v1 or higher in the app that uses the generated code.

## Options worth knowing

- `baseURL` is prepended to every request.
- `validator: 'zod'` validates request and response bodies with the schemas from `@kubb/plugin-zod`.
- `sdk` generates a class-based SDK, grouped by tag or flat, instead of standalone functions. Query plugins need the standalone functions, so leave `sdk` unset when you use them.
- `returnType: 'data'` makes a call resolve to the success body instead of the full result with status, data, and error.
- `throwOnErrorDefault: false` returns documented error responses as values instead of throwing. A single call can still pass `throwOnError`.
