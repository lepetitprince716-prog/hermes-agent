import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.nousresearch.hermes',
  appName: 'Hermes',
  webDir: 'dist',
  server: {
    // iOS: http://localhost origin —— 匹配 dashboard CORS allowlist
    // (^https?://(localhost|127.0.0.1)(:\d+)?$) 且 ATS 对 localhost 默认豁免。
    // Android: https scheme 满足 Secure Context (Clipboard/Crypto)。
    iosScheme: 'http',
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: { enabled: true },
  },
}

export default config
