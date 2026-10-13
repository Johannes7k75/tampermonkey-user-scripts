---
name: vite-plugin-monkey-client
description: Use vite-plugin-monkey's typed client module for importing GM APIs, shared types, monkeyWindow, and userscript context values.
---

# vite-plugin-monkey client

Use this skill when writing TypeScript for a project configured with `vite-plugin-monkey`.

## Client module

The package exposes its typed client API through the `$` alias. Import only the APIs the script uses:

```ts
import {
  GM_addStyle,
  GM_getResourceText,
  GM_getValue,
  GM_setValue,
} from "$";
```

The repository's `src/vite-env.d.ts` references `vite-plugin-monkey/client`, which provides the `$` module declarations. Do not redeclare client API types locally when the package already exports them.

For example, `GM_addStyle` is already typed as:

```ts
interface GmAddStyleType {
  (css: string): HTMLStyleElement;
}
```

Use the imported function directly:

```ts
import { GM_addStyle } from "$";

GM_addStyle(".highlight { color: red; }");
```

Do not create a redundant alias, local interface, or cast merely to reproduce the package's type.

## Available API groups

The client declarations export synchronous APIs such as:

- `GM_addElement`
- `GM_addStyle`
- `GM_getResourceText`
- `GM_getResourceURL`
- `GM_getValue`, `GM_setValue`, `GM_deleteValue`, `GM_listValues`
- `GM_addValueChangeListener`, `GM_removeValueChangeListener`
- `GM_xmlhttpRequest`
- `GM_download`
- `GM_openInTab`
- `GM_registerMenuCommand`, `GM_unregisterMenuCommand`
- `GM_notification`
- `GM_setClipboard`
- `GM_log`
- `GM_info`

The `GM` object exposes promise-oriented counterparts such as `GM.getValue`, `GM.setValue`, `GM.addStyle`, `GM.xmlHttpRequest`, and `GM.getResourceText`. Use the style matching the target userscript managers and existing project code; do not mix callback and promise assumptions without checking the declared type.

The client also exports:

- `monkeyWindow`: a typed window containing page APIs and GM context.
- `unsafeWindow`: the page's original window. Treat it as an unsafe boundary and validate all values crossing it.
- API types such as `GmXmlhttpRequestOption`, `GmDownloadOptions`, `GmInfoType`, and `GmValueListenerId`.

## Type and metadata behavior

Importing a GM API can allow `vite-plugin-monkey` to collect the corresponding `@grant` automatically. Still review the generated metadata and keep explicit `userscript.grant` entries when they document an intentional privilege or when automatic collection is not reliable.

`GM_getResourceText("name")` and `GM_getResourceURL("name")` require a matching resource configured in `vite.config.ts`:

```ts
userscript: {
  grant: ["GM_getResourceText"],
  resource: {
    "data.json": "https://example.com/data.json",
  },
}
```

Keep resource names identical between configuration and code. Parse resource content with validation and handle unavailable or malformed data explicitly.

For cross-origin `GM_xmlhttpRequest`, configure narrow `connect` hosts and validate response status and data shape. Avoid broad wildcards.

## API-specific typing notes

- `GmAddElementType` supports both `(tagName, attributes)` and `(parentNode, tagName, attributes)` overloads with tag-name-aware return types.
- `GmAddStyleType` returns an `HTMLStyleElement`.
- `GmGetValueType` and `GmAsyncGetValueType` support a generic result type and optional default value.
- `GmValueListenerId` is `string | number` because managers differ.
- `GmXmlhttpRequestType` is generic over response type (`text`, `json`, `arraybuffer`, `blob`, `document`, or `stream`) and optional context.
- `GmDownloadType` returns an abort handle; retain it when cancellation is needed.
- Some declarations are manager-specific and marked for Tampermonkey or Violentmonkey. Do not assume every API or option works in both managers.

## Project usage

Each Vite userscript should have the client reference in `src/vite-env.d.ts`:

```ts
/// <reference types="vite-plugin-monkey/client" />
```

Use a project-local `tsconfig.json` with DOM libraries and strict checking. After changing imports or metadata:

```bash
cd <script-directory>
bun run build
```

Inspect the generated `.user.js` header for expected `@grant`, `@resource`, and `@connect` entries, then run:

```bash
bun run build:userscripts
```

## Source reference

This skill is based on the supplied `vite-plugin-monkey` client declaration for the `$` alias and the package's generated client typings:

- `vite-plugin-monkey/dist/client`
- [vite-plugin-monkey repository](https://github.com/lisonge/vite-plugin-monkey)
- [Tampermonkey API documentation](https://www.tampermonkey.net/documentation.php)
- [Violentmonkey GM API documentation](https://violentmonkey.github.io/api/gm/)
