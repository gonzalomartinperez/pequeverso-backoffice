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
- Relative imports inside a feature carry the `.ts` extension so Node can run sources directly;
  `@/` aliases are used by routes and React modules resolved by Next.js.
- Comments explain why and invariants, not what the code does. Biome formats (100 columns).
- `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` stay on.
