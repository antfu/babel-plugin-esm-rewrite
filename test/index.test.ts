/* eslint-disable no-template-curly-in-string */
import { expect, test } from 'vitest'
import babel from '@babel/core'
import plugin from '../src/index'

function transform(code: string) {
  return babel.transform(code, {
    plugins: [[plugin]],
  })?.code
    ?.split(/\n/g)
    .map(line => line.trimEnd())
    .filter(Boolean)
    .join('\n')
}

test('default import', async() => {
  expect(await transform('import foo from \'vue\';console.log(foo.bar)')).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    console.log(__esm_import_0__.default.bar);"
  `)
})

test('named import', async() => {
  expect(await transform('import { ref } from \'vue\';function foo() { return ref(0) }')).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    function foo() {
      return __esm_import_0__.ref(0);
    }"
  `)
})

test('namespace import', async() => {
  expect(await transform('import * as vue from \'vue\';function foo() { return vue.ref(0) }')).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    function foo() {
      return __esm_import_0__.ref(0);
    }"
  `)
})

test('export function declaration', async() => {
  expect(await transform('export function foo() {}')).toMatchInlineSnapshot(`
    "function foo() {}
    Object.defineProperty(__esm_exports__, \\"foo\\", {
      enumerable: true,
      configurable: true,
      get() {
        return foo;
      }
    });"
  `)
})

test('export class declaration', async() => {
  expect(await transform('export class foo {}')).toMatchInlineSnapshot(`
    "class foo {}
    Object.defineProperty(__esm_exports__, \\"foo\\", {
      enumerable: true,
      configurable: true,
      get() {
        return foo;
      }
    });"
  `)
})

test('export var declaration', async() => {
  expect(await transform('export const a = 1, b = 2')).toMatchInlineSnapshot(`
    "const a = 1,
          b = 2;
    Object.defineProperty(__esm_exports__, \\"a\\", {
      enumerable: true,
      configurable: true,
      get() {
        return a;
      }
    });
    Object.defineProperty(__esm_exports__, \\"b\\", {
      enumerable: true,
      configurable: true,
      get() {
        return b;
      }
    });"
  `)
})

test('export named', async() => {
  expect(await transform('const a = 1, b = 2; export { a, b as c }')).toMatchInlineSnapshot(`
    "const a = 1,
          b = 2;
    Object.defineProperty(__esm_exports__, \\"a\\", {
      enumerable: true,
      configurable: true,
      get() {
        return a;
      }
    });
    Object.defineProperty(__esm_exports__, \\"c\\", {
      enumerable: true,
      configurable: true,
      get() {
        return b;
      }
    });"
  `)
})

test('export named from', async() => {
  expect(await transform('export { ref, computed as c } from \'vue\'')).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    Object.defineProperty(__esm_exports__, \\"ref\\", {
      enumerable: true,
      configurable: true,
      get() {
        return __esm_import_0__.ref;
      }
    });
    Object.defineProperty(__esm_exports__, \\"c\\", {
      enumerable: true,
      configurable: true,
      get() {
        return __esm_import_0__.computed;
      }
    });"
  `)
})

test('named exports of imported binding', async() => {
  expect(await transform('import {createApp} from \'vue\';export {createApp}')).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    Object.defineProperty(__esm_exports__, \\"createApp\\", {
      enumerable: true,
      configurable: true,
      get() {
        return __esm_import_0__.createApp;
      }
    });"
  `)
})

test('export * from', async() => {
  expect(await transform('export * from \'vue\'\n' + 'export * from \'react\'')).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    __esm_export_all__(__esm_import_0__)
    const __esm_import_1__ = await __esm_import__(\\"react\\");
    __esm_export_all__(__esm_import_1__)"
  `)
})

test('export * as from', async() => {
  expect(await transform('export * as foo from \'vue\'')).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    Object.defineProperty(__esm_exports__, \\"foo\\", {
      enumerable: true,
      configurable: true,
      get() {
        return __esm_import_0__;
      }
    });"
  `)
})

test('export default', async() => {
  expect(await transform('export default {}')).toMatchInlineSnapshot('"__esm_exports__.default = {}"')
})

test('import.meta', async() => {
  expect(await transform('console.log(import.meta.url)')).toMatchInlineSnapshot('"console.log(__esm_import_meta__.url);"')
})

test('dynamic import', async() => {
  const code = await transform('export const i = () => import(\'./foo\')')
  expect(code).toMatchInlineSnapshot(`
    "const i = () => __esm_dynamic_import__('./foo');
    Object.defineProperty(__esm_exports__, \\"i\\", {
      enumerable: true,
      configurable: true,
      get() {
        return i;
      }
    });"
  `)
})

test('do not rewrite method definition', async() => {
  const code = await transform('import { fn } from \'vue\';class A { fn() { fn() } }')
  expect(code).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    class A {
      fn() {
        __esm_import_0__.fn();
      }
    }"
  `)
})

test('do not rewrite when variable is in scope', async() => {
  const code = await transform('import { fn } from \'vue\';function A(){ const fn = () => {}; return { fn }; }')
  expect(code).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    function A() {
      const fn = () => {};
      return {
        fn
      };
    }"
  `)
})

// #5472
test('do not rewrite when variable is in scope with object destructuring', async() => {
  const code = await transform('import { fn } from \'vue\';function A(){ let {fn, test} = {fn: \'foo\', test: \'bar\'}; return { fn }; }')
  expect(code).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    function A() {
      let {
        fn,
        test
      } = {
        fn: 'foo',
        test: 'bar'
      };
      return {
        fn
      };
    }"
  `)
})

// #5472
test('do not rewrite when variable is in scope with array destructuring', async() => {
  const code = await transform('import { fn } from \'vue\';function A(){ let [fn, test] = [\'foo\', \'bar\']; return { fn }; }')
  expect(code).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    function A() {
      let [fn, test] = ['foo', 'bar'];
      return {
        fn
      };
    }"
  `)
})

// #5727
test('rewrite variable in string interpolation in function nested arguments', async() => {
  const code = await transform('import { fn } from \'vue\';function A({foo = `test${fn}`} = {}){ return {}; }')
  expect(code).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    function A({
      foo = \`test\${__esm_import_0__.fn}\`
    } = {}) {
      return {};
    }"
  `)
})

// #6520
test('rewrite variables in default value of destructuring params', async() => {
  const code = await transform('import { fn } from \'vue\';function A({foo = fn}){ return {}; }')
  expect(code).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    function A({
      foo = __esm_import_0__.fn
    }) {
      return {};
    }"
  `)
})

test('do not rewrite when function declaration is in scope', async() => {
  const code = await transform('import { fn } from \'vue\';function A(){ function fn() {}; return { fn }; }')
  expect(code).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    function A() {
      function fn() {}
      ;
      return {
        fn
      };
    }"
  `)
})

test('do not rewrite catch clause', async() => {
  const code = await transform('import {error} from \'./dependency\';try {} catch(error) {}')
  expect(code).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"./dependency\\");
    try {} catch (error) {}"
  `)
})

// #2221
test('should declare variable for imported super class', async() => {
  expect(await transform('import { Foo } from \'./dependency\';' + 'class A extends Foo {}')).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"./dependency\\");
    const Foo = __esm_import_0__.Foo;
    class A extends Foo {}"
  `)

  // exported classes: should prepend the declaration at root level, before the
  // first class that uses the binding
  expect(await transform('import { Foo } from \'./dependency\';' + 'export default class A extends Foo {}\n' + 'export class B extends Foo {}')).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"./dependency\\");
    const Foo = __esm_import_0__.Foo;
    class A extends Foo {}
    Object.defineProperty(__esm_exports__, \\"default\\", {
      enumerable: true,
      configurable: true,
      get() {
        return A;
      }
    });
    const Foo = __esm_import_0__.Foo;
    class B extends Foo {}
    Object.defineProperty(__esm_exports__, \\"B\\", {
      enumerable: true,
      configurable: true,
      get() {
        return B;
      }
    });"
  `)
})

// #4049
test('should handle default export variants', async() => {
  // default anonymous functions
  expect(await transform('export default function() {}\n')).toMatchInlineSnapshot('"__esm_exports__.default = function () {}"')
  // default anonymous class
  expect(await transform('export default class {}\n')).toMatchInlineSnapshot('"__esm_exports__.default = class {}"')
  // default named functions
  expect(await transform('export default function foo() {}\n' + 'foo.prototype = Object.prototype;')).toMatchInlineSnapshot(`
    "function foo() {}
    Object.defineProperty(__esm_exports__, \\"default\\", {
      enumerable: true,
      configurable: true,
      get() {
        return foo;
      }
    });
    foo.prototype = Object.prototype;"
  `)
  // default named classes
  expect(await transform('export default class A {}\n' + 'export class B extends A {}')).toMatchInlineSnapshot(`
    "class A {}
    Object.defineProperty(__esm_exports__, \\"default\\", {
      enumerable: true,
      configurable: true,
      get() {
        return A;
      }
    });
    class B extends A {}
    Object.defineProperty(__esm_exports__, \\"B\\", {
      enumerable: true,
      configurable: true,
      get() {
        return B;
      }
    });"
  `)
})

test('overwrite bindings', async() => {
  expect(
    await transform(
      'import { inject } from \'vue\';'
        + 'const a = { inject }\n'
        + 'const b = { test: inject }\n'
        + 'function c() { const { test: inject } = { test: true }; console.log(inject) }\n'
        + 'const d = inject \n'
        + 'function f() {  console.log(inject) }\n'
        + 'function e() { const { inject } = { inject: true } }\n'
        + 'function g() { const f = () => { const inject = true }; console.log(inject) }\n',
    ),
  ).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    const a = {
      __esm_import_0__.inject
    };
    const b = {
      test: __esm_import_0__.inject
    };
    function c() {
      const {
        test: inject
      } = {
        test: true
      };
      console.log(inject);
    }
    const d = inject;
    function f() {
      console.log(__esm_import_0__.inject);
    }
    function e() {
      const {
        inject
      } = {
        inject: true
      };
    }
    function g() {
      const f = () => {
        const inject = true;
      };
      console.log(__esm_import_0__.inject);
    }"
  `)
})

test('Empty array pattern', async() => {
  expect(await transform('const [, LHS, RHS] = inMatch;')).toMatchInlineSnapshot('"const [, LHS, RHS] = inMatch;"')
})

test('function argument destructure', async() => {
  expect(
    await transform(
      `
import { foo, bar } from 'foo'
const a = ({ _ = foo() }) => {}
function b({ _ = bar() }) {}
function c({ _ = bar() + foo() }) {}
`,
    ),
  ).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"foo\\");
    const a = ({
      _ = __esm_import_0__.foo()
    }) => {};
    function b({
      _ = __esm_import_0__.bar()
    }) {}
    function c({
      _ = __esm_import_0__.bar() + __esm_import_0__.foo()
    }) {}"
  `)
})

test('object destructure alias', async() => {
  expect(
    await transform(
      `
import { n } from 'foo'
const a = () => {
  const { type: n = 'bar' } = {}
  console.log(n)
}
`,
    ),
  ).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"foo\\");
    const a = () => {
      const {
        type: n = 'bar'
      } = {};
      console.log(n);
    };"
  `)
})

test('nested object destructure alias', async() => {
  expect(
    await transform(
      `
import { remove, add, get, set, rest, objRest } from 'vue'

function a() {
  const {
    o: { remove },
    a: { b: { c: [ add ] }},
    d: [{ get }, set, ...rest],
    ...objRest
  } = foo

  remove()
  add()
  get()
  set()
  rest()
  objRest()
}

remove()
add()
get()
set()
rest()
objRest()
`,
    ),
  ).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    function a() {
      const {
        o: {
          remove
        },
        a: {
          b: {
            c: [add]
          }
        },
        d: [{
          get
        }, set, ...rest],
        ...objRest
      } = foo;
      remove();
      add();
      get();
      set();
      rest();
      objRest();
    }
    __esm_import_0__.remove();
    __esm_import_0__.add();
    __esm_import_0__.get();
    __esm_import_0__.set();
    __esm_import_0__.rest();
    __esm_import_0__.objRest();"
  `)
})

test('class props', async() => {
  expect(
    await transform(
      `
import { remove, add } from 'vue'

class A {
  remove = 1
  add = null
}
`,
    ),
  ).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    class A {
      remove = 1;
      add = null;
    }"
  `)
})

test('declare scope', async() => {
  expect(
    await transform(
      `
import { aaa, bbb, ccc, ddd } from 'vue'

function foobar() {
  ddd()

  const aaa = () => {
    bbb(ccc)
    ddd()
  }
  const bbb = () => {
    console.log('hi')
  }
  const ccc = 1
  function ddd() {}

  aaa()
  bbb()
  ccc()
}

aaa()
bbb()
`,
    ),
  ).toMatchInlineSnapshot(`
    "const __esm_import_0__ = await __esm_import__(\\"vue\\");
    function foobar() {
      ddd();
      const aaa = () => {
        bbb(ccc);
        ddd();
      };
      const bbb = () => {
        console.log('hi');
      };
      const ccc = 1;
      function ddd() {}
      aaa();
      bbb();
      ccc();
    }
    __esm_import_0__.aaa();
    __esm_import_0__.bbb();"
  `)
})
