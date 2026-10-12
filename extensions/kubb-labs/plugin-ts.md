# TypeScript

Generates TypeScript types and interfaces from your OpenAPI spec. You get a type for every schema, plus the request, response, and parameter types of each operation.

Most other Kubb plugins build on these types. The client, query, mock, and test plugins import them, so add this plugin first.

## Setup

No other plugins or packages are needed.

## Options worth knowing

- `enum.type` sets how enums are written: `asConst` (default), `enum`, `constEnum`, `literal`, or `inlineLiteral`. `enum.constCasing`, `enum.typeSuffix`, and `enum.keyCasing` tune the names.
- `syntaxType` writes object schemas as `type` aliases (default) or `interface` declarations.
- `optionalType` sets how optional properties are written: `questionToken` (default), `undefined`, or `questionTokenAndUndefined`.
- `arrayType` writes arrays as `T[]` (default) or `Array<T>`.
- `group` splits the output into folders by tag or path. It does not work with `output.mode: 'file'`.
