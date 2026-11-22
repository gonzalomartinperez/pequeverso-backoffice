# TypeScript conventions

## TypeScript style

The [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) is the
readability reference, adapted to React/Next.js and this toolchain:

- Named exports only, except where Next.js requires a default export (pages, layouts, `proxy`).
- File names in kebab-case; React components in PascalCase; route folders follow the URL (Spanish).
- `type` aliases for data shapes and unions (discriminated unions for states and results);
  `interface` for ports implemented by adapters. No `enum` and no parameter properties
  (`erasableSyntaxOnly`); classes only for stateful adapters.
- No `any`; `unknown` at boundaries, then runtime validation (`adapters/validate.ts`). Typed
  dictionaries (`Record<Union, …>`) instead of string-keyed objects.
- Imports carry the file extension so Node can run sources directly. Inside a feature use
  relative paths; across folders use the Node subpath imports declared in `package.json`
  (`#features/*`, `#server/*`, `#shared/*`, for example `#shared/ui/button.tsx`). There is no
  tsconfig `paths` alias; the boundary guard rejects `@/` and undeclared `#` prefixes.
- Comments explain why and invariants, not what the code does. Biome formats (100 columns).
- `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` stay on.
