---
name: tampermonkey-project
description: Work in the Johannes7k75 tampermonkey-user-scripts repository, including script metadata, Vite builds, and the local release bundle.
---

# Repository userscript workflow

## Project layout

- Each active userscript has its own directory.
- Vite-based scripts contain `src/main.ts`, `vite.config.ts`, `tsconfig.json`, `package.json`, and `script.json`.
- `script.json` is the release manifest consumed by `scripts/build-userscripts.ts`.
- Directories ending in `.old` are legacy implementations and are excluded from the local build.
- Root `dist/` contains the collected release assets and is Git-ignored.

## Adding or migrating a script

1. Put the active implementation in its own directory.
2. Use TypeScript for new Vite scripts and enable strict checking.
3. Move userscript headers into `vite.config.ts` under `userscript`.
4. Preserve required `@match`, `@grant`, `@resource`, `@updateURL`, and `@downloadURL` values.
5. Add a `script.json` entry:

```json
{
  "$schema": "../scripts/script.schema.json",
  "id": "example-script",
  "name": "Example Script",
  "type": "vite",
  "asset": "example-script.user.js",
  "output": "example-script.user.js"
}
```

6. Ensure `asset` names are unique across all active scripts.
7. Keep all package dependencies in the root workspace and use only the root `bun.lock`.

Source scripts may use `"type": "source"` with a sibling `.js` file and `"source"` instead of `"output"`. Prefer migrating scripts to Vite/TypeScript when they need typed code, bundling, or generated metadata.

## Commands

Install all workspace dependencies from the repository root:

```bash
bun install --frozen-lockfile
```

Build one Vite script after installing from the root:

```bash
cd <script-directory>
bun run build
```

Build every active userscript into root `dist/`:

```bash
bun run build:userscripts
```

The root builder:

- discovers `script.json` files;
- skips `node_modules`, hidden directories, and `.old` directories;
- builds Vite scripts with their local `bun run build`;
- copies source scripts;
- clears and recreates root `dist/`;
- rejects malformed manifests, missing files, failed builds, and duplicate assets.

Validate repository tooling:

```bash
bunx --package typescript tsc --noEmit -p tsconfig.json
```

## Change checklist

- Read the old implementation before migrating behavior.
- Keep selectors and URL matches as narrow and stable as possible.
- Use explicit return types and null checks for DOM operations.
- Review generated metadata in the built `.user.js`, especially grants and resources.
- Run the affected script build and then `bun run build:userscripts`.
- Do not commit generated root `dist/` output unless explicitly requested.
- Do not remove unrelated worktree changes.

## Repository references

- `scripts/script.schema.json` defines the `script.json` contract.
- `scripts/build-userscripts.ts` defines local discovery and packaging behavior.
- `.github/workflows/ReleaseUserscripts.yml` defines the release packaging model.
- Root `tsconfig.json` checks repository TypeScript tooling.
