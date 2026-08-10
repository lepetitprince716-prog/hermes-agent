import shared from '../../eslint.config.shared.mjs'
import globals from 'globals'

export default [
  ...shared,
  {
    // Mobile 是纯浏览器 app（Capacitor webview），合法使用 browser globals
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    ignores: ['dist/**', 'ios/**', 'android/**', 'build/**'],
  },
]
