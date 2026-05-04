import antfu from '@antfu/eslint-config'

export default antfu({
  react: true,
  typescript: true,
  yaml: false,
  stylistic: false,
  ignores: ['wing', 'apps/web/src/schemas/**'],
  rules: {
    'no-template-curly-in-string': 'off',
    // Allow exporting variants alongside components (shadcn pattern)
    'react-refresh/only-export-components': 'off',
    // Allow array index as key when items have no stable ID
    'react/no-array-index-key': 'off',
    // Allow dangerouslySetInnerHTML for trusted content (chart tooltips)
    'react/dom-no-dangerously-set-innerhtml': 'off',
    // Allow direct setState in useEffect for sync patterns
    'react-hooks-extra/no-direct-set-state-in-use-effect': 'off',
  },
})
  .override('antfu/react/setup', (config) => ({
    ...config,
    plugins: Object.fromEntries(
      Object.entries(config.plugins ?? {}).filter(([, plugin]) => plugin && typeof plugin === 'object'),
    ),
  }))
  .override('antfu/react/typescript', (config) => ({
    ...config,
    rules: Object.fromEntries(Object.entries(config.rules ?? {}).filter(([rule]) => !rule.startsWith('react-dom/'))),
  }))
