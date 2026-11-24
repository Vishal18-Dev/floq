import { NativeModules, TurboModuleRegistry } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/**
 * Crash and error reports to Sentry. Off until `expo.extra.sentryDsn` is set in
 * app.json (a DSN is not a secret; it only lets the app send reports).
 * No personal data: no IP, no user, no request bodies.
 * ponytail: no source-map upload, so JS stack traces are minified. Add the
 * `@sentry/react-native` config plugin + SENTRY_AUTH_TOKEN when that hurts.
 */
export function initCrashReporting(): void {
  const dsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;
  if (!dsn || __DEV__) return;
  // An OTA can land on an APK built before Sentry was added. Its native module
  // is missing there, and loading the SDK would crash on launch, so skip.
  const native = (TurboModuleRegistry as any).get?.('RNSentry') ?? NativeModules.RNSentry;
  if (!native) return;
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn,
      environment: Updates.channel || 'unknown',
      sendDefaultPii: false,
      tracesSampleRate: 0,
      // console logs can carry order and customer data
      beforeBreadcrumb: (b: { category?: string }) => (b.category === 'console' ? null : b),
    });
  } catch {
    // Reporting must never take the app down.
  }
}
