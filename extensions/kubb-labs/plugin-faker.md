# Faker

Generates a Faker.js mock-data factory for every schema in your OpenAPI spec. Use the factories in tests, Storybook, and local development without a running backend. Each factory accepts partial data that overrides the generated values.

`@kubb/plugin-msw` can use these factories to fill mock responses.

## Setup

- Add `@kubb/plugin-ts` for the factory return types.
- Install `@faker-js/faker` v9 or higher in the app that uses the generated code.

## Options worth knowing

- `seed` passes a fixed seed to `faker.seed(...)`, so every run returns the same data.
- `locale` sets the Faker locale. The default is `en`.
- `dateParser` formats date and time strings with `faker` (default), `dayjs`, or `moment`. Install the library you pick.
- `regexGenerator` turns a `pattern` into a string with `faker` (default) or `randexp`.
- `typeMode` sets the factory types: `inferred` (default) derives them from the generated values, `schema` uses the declared model type.
