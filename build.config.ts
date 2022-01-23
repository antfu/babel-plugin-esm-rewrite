import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
  ],
  declaration: true,
  clean: true,
  rollup: {
    esbuild: {},
    emitCJS: true,
  },
  externals: [
    '@babel/helper-plugin-utils',
    '@babel/core',
    '@babel/types',
  ],
})
