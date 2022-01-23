import { declare } from '@babel/helper-plugin-utils'
import type { Node, NodePath } from '@babel/core'
import t from '@babel/types'
import babel from '@babel/core'

export const ssrModuleExportsKey = '__esm_exports__'
export const ssrImportKey = '__esm_import__'
export const ssrDynamicImportKey = '__esm_dynamic_import__'
export const ssrExportAllKey = '__esm_exportAll__'
export const ssrImportMetaKey = '__esm_import_meta__'
export const ssrImportItemPrefix = '__esm_import_'

export default declare(() => {
  let uid = 0
  const deps = new Set<string>()
  const idToImportMap = new Map<string, string>()
  const imports: NodePath<t.ImportDeclaration>[] = []

  function defineImport(node: Node, source: string) {
    deps.add(source)
    const importId = `${ssrImportItemPrefix}${uid++}__`
    return importId
  }

  function defineExport(name: string, local = name) {
    return babel.parse(
      `Object.defineProperty(${ssrModuleExportsKey},"${name}",{ enumerable: true, configurable: true, get(){ return ${local} }});`,
    )
  }

  return {
    name: 'babel-plugin-esm-rewrite',
    visitor: {
      ImportDeclaration(path) {
        imports.push(path)
        const node = path.node
        // import foo from 'foo' --> foo -> __import_foo__.default
        // import { baz } from 'foo' --> baz -> __import_foo__.baz
        // import * as ok from 'foo' --> ok -> __import_foo__
        const importId = defineImport(node, node.source.value as string)
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier' && spec.imported.type === 'Identifier') {
            idToImportMap.set(
              spec.local.name,
              `${importId}.${spec.imported.name}`,
            )
          }
          else if (spec.type === 'ImportDefaultSpecifier') {
            idToImportMap.set(spec.local.name, `${importId}.default`)
          }
          else {
            // namespace specifier
            idToImportMap.set(spec.local.name, importId)
          }
        }
        path.replaceWith(
          t.variableDeclaration(
            'const',
            [
              t.variableDeclarator(
                t.identifier(importId),
                t.awaitExpression(
                  t.callExpression(
                    t.identifier(ssrImportKey),
                    [path.node.source],
                  ),
                ),
              ),
            ],
          ),
        )
        path.skip()
      },
      ExportDeclaration(path) {
        const replaces: any[] = []

        path.traverse({
          Identifier(path) {
            if (path.parent.type === 'ExportSpecifier' && path.parent.exported === path.node) {
              const localname = path.parent.local.name
              const name = path.node.name
              replaces.push(defineExport(name, idToImportMap.get(localname) || localname))
            }
          },
        })

        path.replaceWithMultiple(replaces)
        path.skip()
      },
      Identifier(path) {
        const name = path.node.name
        if (!idToImportMap.has(name))
          return

        const binding = path.scope.bindings[name]
        if (!binding || binding.kind === 'module') {
          path.replaceWith(
            t.identifier(idToImportMap.get(name) || name),
          )
        }
        else {
          console.log({ name, binding })
        }
      },
    },
  }
})
