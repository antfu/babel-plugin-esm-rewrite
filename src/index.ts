import { declare } from '@babel/helper-plugin-utils'
import type { Node, NodePath } from '@babel/core'

export interface Options {
  keyModuleExport?: string
  keyImport?: string
  keyDynamicImport?: string
  keyExportAll?: string
  keyImportMeta?: string
  keyImportBindingPrefix?: string
}

export default declare((api, options = {}) => {
  const t = api.types

  const {
    keyModuleExport = '__esm_exports__',
    keyImport = '__esm_import__',
    keyDynamicImport = '__esm_dynamic_import__',
    keyExportAll = '__esm_export_all__',
    keyImportMeta = '__esm_import_meta__',
    keyImportBindingPrefix = '__esm_import_',
  } = options

  const map = new WeakMap<any, {
    uid: number
    id: Map<string, string>
  }>()

  function setIdMap(file: any, name: string, value: string) {
    if (name.startsWith(keyImportBindingPrefix))
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
    return `${keyImportBindingPrefix}${getUid(file)}__`
  }

  function createExport(name: string, local = name) {
    return api.parse(
      `Object.defineProperty(${keyModuleExport},"${name}",{ enumerable: true, configurable: true, get(){ return ${local} }});`,
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
              t.identifier(keyImport),
              [t.stringLiteral(source)],
            ),
          ),
        ),
      ],
    )
  }

  function _resolveId(name: string, path: NodePath<Node>, file: any) {
    if (!getIdMap(file, name))
      return name

    let currentPath = path
    let binding = currentPath.scope.getBinding(name)
    while (!binding && currentPath.parentPath) {
      currentPath = currentPath.parentPath
      binding = currentPath.scope.getBinding(name)
    }
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

        const resolveId = (id: string) => _resolveId(id, path, file)

        if (node.type === 'ExportNamedDeclaration') {
          if (node.declaration) {
            const decl = node.declaration
            replaces.push(decl)
            // export const a = 1, b = 2;
            if (decl.type === 'VariableDeclaration') {
              for (const declarator of decl.declarations) {
                if (declarator.id.type === 'Identifier')
                  replaces.push(createExport(declarator.id.name))
              }
            }
            // export function a () {}
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
            // export { foo } from 'foo'
            if (source) {
              importId = getImportId(file)
              replaces.push(createImport(importId, source.value))
            }
            for (const spec of node.specifiers) {
              // export { foo }
              if (spec.type === 'ExportSpecifier') {
                if (spec.exported.type === 'Identifier') {
                  let local = spec.local.name
                  const exported = spec.exported.name
                  if (source)
                    local = `${importId}.${local}`
                  else
                    local = resolveId(local)
                  replaces.push(createExport(exported, local))
                }
              }
              // export * as foo from 'foo'
              else if (spec.type === 'ExportNamespaceSpecifier') {
                const local = spec.exported.name
                replaces.push(createExport(local, importId))
              }
            }
          }
        }
        // export * from 'foo'
        else if (node.type === 'ExportAllDeclaration') {
          const source = node.source
          if (source) {
            const importId = getImportId(file)
            replaces.push(createImport(importId, source.value))
            replaces.push(t.callExpression(
              t.identifier(keyExportAll),
              [t.identifier(importId)],
            ))
          }
        }
        // export default foo
        else if (node.type === 'ExportDefaultDeclaration') {
          // named function
          if ((node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'ClassDeclaration') && node.declaration.id) {
            replaces.push(node.declaration)
            replaces.push(createExport('default', node.declaration.id.name))
          }
          // other literals
          else {
            let decl = node.declaration
            if (decl.type === 'FunctionDeclaration')
              decl = t.functionExpression(decl.id, decl.params, decl.body, decl.generator, decl.async)
            if (decl.type === 'ClassDeclaration')
              decl = t.classExpression(decl.id, decl.superClass, decl.body)

            replaces.push(t.assignmentExpression(
              '=',
              t.memberExpression(
                t.identifier(keyModuleExport),
                t.identifier('default'),
              ),
              decl as any,
            ))
          }
        }

        path.replaceWithMultiple(replaces)
        path.skip()
      },
      // dynamic import
      Import(path) {
        if (path.parentPath) {
          path.parentPath.replaceWith(
            t.callExpression(
              t.identifier(keyDynamicImport),
              (path.parent as any).arguments,
            ),
          )
        }
      },
      // import.meta
      MetaProperty(path) {
        path.replaceWith(t.identifier(keyImportMeta))
        path.skip()
      },
      Identifier(path, file) {
        // as a member expression
        if (path.parent.type === 'MemberExpression' && path.parent.computed === false && path.parent.object !== path.node)
          return
        // as a class member
        if (path.parent.type === 'ClassMethod' || path.parent.type === 'ClassProperty')
          return
        // declarations
        if (['FunctionDeclaration', 'FunctionExpression', 'VariableDeclaration', 'VariableDeclarator'].includes(path.parent.type))
          return

        const id = _resolveId(path.node.name, path, file)
        if (id === path.node.name)
          return

        // import Foo from 'foo'
        // class A extends Foo {}
        if (path.parentPath && path.parent.type === 'ClassDeclaration' && path.parent.superClass === path.node) {
          path.parentPath.replaceWithMultiple([
            t.variableDeclaration('const', [t.variableDeclarator(path.node, t.identifier(id))]),
            path.parent,
          ])
        }
        else {
          path.replaceWith(t.identifier(id))
        }
        path.skip()
      },
    },
  }
})
