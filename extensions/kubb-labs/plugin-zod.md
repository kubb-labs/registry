# Zod

Generates Zod v4 schemas from your OpenAPI spec. Use them to validate API responses, form input, and query params at runtime.

The schemas can stand on their own. With `inferred: true`, the plugin also exports a `z.infer` type next to each schema, so you can skip `@kubb/plugin-ts`. Client plugins such as `@kubb/plugin-fetch` and `@kubb/plugin-axios` use these schemas when you set their `validator` option.

## Setup

Install Zod v4 or higher in the app that uses the generated code. No other plugins are needed.

## Options worth knowing

- `mini` generates Zod Mini schemas for smaller bundles, and switches `importPath` to `zod/mini`.
- `importPath` sets the module the files import `z` from. The default is `zod`.
- `inferred` exports a `z.infer` type alias next to each schema.
- `coercion` wraps schemas in `z.coerce`, so input is converted before validation. Pass an object to coerce only dates, strings, or numbers.
- `guidType` picks `z.uuid()` (default) or `z.guid()` for `format: uuid`.
- `regexType` writes a `pattern` as a regex literal (default) or a `RegExp` constructor.
- `typeGuards` adds `is*` type guards and `assert*` assertions.
- `compile` wraps schemas in `z.compile` for faster validation.
