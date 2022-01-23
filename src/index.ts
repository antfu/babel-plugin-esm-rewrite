import { declare } from '@babel/helper-plugin-utils'
import type { Node, NodePath } from '@babel/traverse'
import type t from '@babel/types'

export const ssrModuleExportsKey = '__esm_exports__'
export const ssrImportKey = '__esm_import__'
export const ssrDynamicImportKey = '__esm_dynamic_import__'
export const ssrExportAllKey = '__esm_exportAll__'
export const ssrImportMetaKey = '__esm_import_meta__'
export const ssrImportItemPrefix = '__esm_import_'

export default declare((api) => {
  const t = api.types

  const map = new WeakMap<any, {
    uid: number
    id: Map<string, string>
  }>()

  function setIdMap(file: any, name: string, value: string) {
    if (name.startsWith(ssrImportItemPrefix))
      return
    if (!map.has(file))
      map.set(file, { uid: 0, id: new Map() })
    map.get(file)!.id.set(name, value)
  }

  function getIdMap(file: any, name: string) {
    return map.get(file)?.id.get(name)
  }

  function getUid(file: any) {
    if (!map.has(file))
      map.set(file, { uid: 0, id: new Map() })
    return map.get(file)!.uid++
  }

  function getImportId(file: any) {
    return `${ssrImportItemPrefix}${getUid(file)}__`
  }

  function createExport(name: string, local = name) {
    return api.parse(
      `Object.defineProperty(${ssrModuleExportsKey},"${name}",{ enumerable: true, configurable: true, get(){ return ${local} }});`,
    )
  }
  function createImport(id: string, source: string) {
    return t.variableDeclaration(
      'const',
      [
        t.variableDeclarator(
          t.identifier(id),
          t.awaitExpression(
            t.callExpression(
              t.identifier(ssrImportKey),
              [t.stringLiteral(source)],
            ),
          ),
        ),
      ],
    )
  }

  function _getId(name: string, path: NodePath<Node>, file: any) {
    if (!getIdMap(file, name))
      return name

    const binding = path.scope.bindings[name]
    if (!binding || binding.kind === 'module')
      return getIdMap(file, name) || name
    return name
  }

  return {
    name: 'babel-plugin-esm-rewrite',
    visitor: {
      ImportDeclaration(path, file) {
        const node = path.node
        // import foo from 'foo' --> foo -> __import_foo__.default
        // import { baz } from 'foo' --> baz -> __import_foo__.baz
        // import * as ok from 'foo' --> ok -> __import_foo__
        const importId = getImportId(file)
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier' && spec.imported.type === 'Identifier') {
            setIdMap(
              file,
              spec.local.name,
              `${importId}.${spec.imported.name}`,
            )
          }
          else if (spec.type === 'ImportDefaultSpecifier') {
            setIdMap(file, spec.local.name, `${importId}.default`)
          }
          else {
            // namespace specifier
            setIdMap(file, spec.local.name, importId)
          }
        }
        path.replaceWith(createImport(importId, node.source.value))
        path.skip()
      },
      ExportDeclaration(path, file) {
        const replaces: any[] = []
        const node = path.node

        const getId = (id: string) => _getId(id, path, file)

        if (node.type === 'ExportNamedDeclaration') {
          if (node.declaration) {
            const decl = node.declaration
            replaces.push(decl)
            if (decl.type === 'VariableDeclaration') {
              for (const declarator of decl.declarations) {
                if (declarator.id.type === 'Identifier')
                  replaces.push(createExport(declarator.id.name))
              }
            }
            else if (decl.type === 'ClassDeclaration' || decl.type === 'FunctionDeclaration') {
              if (decl.id) {
                const name = decl.id.name
                replaces.push(createExport(name, name))
              }
            }
          }
          else if (node.specifiers) {
            const source = node.source
            let importId: string | undefined
            if (source) {
              importId = getImportId(file)
              replaces.push(createImport(importId, source.value))
            }
            for (const spec of node.specifiers) {
              if (spec.type === 'ExportSpecifier') {
                if (spec.exported.type === 'Identifier') {
                  let local = spec.local.name
                  const exported = spec.exported.name
                  if (source)
                    local = `${importId}.${local}`
                  else
                    local = getId(local)
                  replaces.push(createExport(exported, local))
                }
              }
            }
          }
        }

        path.replaceWithMultiple(replaces)
        path.skip()
      },
      Identifier(path, file) {
        const id = _getId(path.node.name, path, file)
        if (id !== path.node.name)
          path.replaceWith(t.identifier(id))
      },
    },
  }
})
