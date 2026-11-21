# Contributing

## Setup

```bash
nvm use
npm run setup
npx playwright install --with-deps chromium firefox webkit
```

The browser install is needed for the browser suite. For local runtime settings, copy
`.env.example` to `.env.local` and keep local values out of commits.

## Checks

```bash
npm run check
npm run test:db
npm run test:browser
```

The database and browser suites require a disposable PostgreSQL database. See
[CI](docs/ci.md) for what runs in CI and the fixture requirements.

## Pull requests

- Start task branches from `develop` and open pull requests into `develop`.
- Use Conventional Commits and describe how you verified the change. Include desktop, dark and
  mobile screenshots for UI changes.
- Merge with a merge commit once the required checks pass. Releases merge `develop` into `main`.
- With the owner's explicit authorization, branch `hotfix/<short-name>` from `main`, open a pull
  request into `main` and merge `main` back into `develop` after the hotfix lands.

See the [repository guidelines](AGENTS.md), [glossary](docs/GLOSSARY.md) and
[TypeScript style guide](docs/reference/typescript-style.md#typescript-style).
