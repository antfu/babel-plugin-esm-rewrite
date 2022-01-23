# babel-plugin-esm-rewrite

[![NPM version](https://img.shields.io/npm/v/babel-plugin-esm-rewrite?color=a1b858&label=)](https://www.npmjs.com/package/babel-plugin-esm-rewrite)

Rewrites ESM syntax to function calls, so they can be evaluated without ESM context. Ported from [Vite's ssrTransfrom](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/ssr/ssrTransform.ts) but as a Babel plugin.

```js
// input
import { ref } from 'vue'
function foo() {
  return ref(0)
}
```

```ts
// output
const __esm_import_0__ = await __esm_import__('vue')
function foo() {
  return __esm_import_0__.ref(0)
}
```

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) License © 2022 [Anthony Fu](https://github.com/antfu)
