---
name: tampermonkey-userscripts
description: Develop, migrate, and review Tampermonkey or Violentmonkey userscripts, including Vite and vite-plugin-monkey projects.
---

# Tampermonkey userscripts

Use this skill when creating or migrating a userscript, editing its metadata, adding GM APIs/resources, or configuring `vite-plugin-monkey`.

## Metadata

- Keep the generated metadata block at the beginning of the built file.
- Prefer narrow `@match` patterns over broad `@include` patterns.
- Set a stable `@name`, `@namespace`, and increment `@version` for releases.
- Declare only the APIs actually used with `@grant`.
- Declare cross-origin hosts explicitly with `@connect` when using network APIs.
- Treat `@require` and `@resource` URLs as supply-chain dependencies. Prefer pinned, trusted URLs.
- Inspect the built header after changing metadata or GM API imports.

Canonical metadata shape:

```js
// ==UserScript==
// @name         Example
// @namespace    https://example.com/userscripts
// @version      1.0.0
// @description  Example userscript
// @match        https://example.com/*
// @grant        GM_getValue
// ==/UserScript==
```

## DOM and runtime behavior

- `@run-at` controls injection timing, not application rendering. Query DOM nodes defensively.
- For dynamically rendered pages, use a narrowly scoped `MutationObserver`.
- Make initialization idempotent so repeated SPA updates do not duplicate controls, styles, listeners, or observers.
- Disconnect observers when their target has been found or the feature is no longer needed.
- Prefer `textContent`, `createElement`, and explicit attributes over interpolated `innerHTML`.
- Validate parsed resource data before using it.
- Avoid `unsafeWindow`, `eval`, `new Function`, and dynamic script construction unless unavoidable.

## GM APIs

- Use the API variant supported by the target managers. This repository commonly uses imports from `"$"` supplied by `vite-plugin-monkey`.
- Add matching `userscript.grant` entries when explicit metadata is clearer or automatic grant collection is not sufficient.
- For styles, use `GM_addStyle` when the script requires a userscript-manager API:

```ts
import { GM_addStyle as importedGMAddStyle } from "$";

type GmAddStyleType = (css: string) => HTMLStyleElement;

/**
 * @see https://www.tampermonkey.net/documentation.php#api:GM_addStyle
 * @see https://violentmonkey.github.io/api/gm/#gm_addstyle
 */
const GM_addStyle: GmAddStyleType = importedGMAddStyle;
```

## vite-plugin-monkey

Keep `vite-plugin-monkey` last in the Vite plugin list. A typical configuration is:

```ts
import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

export default defineConfig({
  plugins: [
    monkey({
      entry: "src/main.ts",
      userscript: {
        name: "Example",
        namespace: "https://example.com/userscripts",
        version: "1.0.0",
        match: ["https://example.com/*"],
        grant: ["GM_getValue"],
        resource: {
          "data.json": "https://example.com/data.json",
        },
      },
    }),
  ],
});
```

The plugin can bundle TypeScript, collect imported GM APIs, and generate `@grant`, `@resource`, and `@require` metadata. Automatic grant collection is not a substitute for reviewing the generated header.

## Sources

- [Tampermonkey documentation](https://www.tampermonkey.net/documentation.php)
- [Violentmonkey metadata block](https://violentmonkey.github.io/api/metadata-block/)
- [Violentmonkey privileged APIs](https://violentmonkey.github.io/api/gm/)
- [vite-plugin-monkey README](https://github.com/lisonge/vite-plugin-monkey/blob/main/README.md)
- [vite-plugin-monkey metadata implementation](https://github.com/lisonge/vite-plugin-monkey/blob/main/vite-plugin-monkey/src/node/userscript/index.ts)
- [MDN: MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
- [MDN: innerHTML security considerations](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML)
