// Dynamic Expo config. Extends app.json with the Firebase native plugin and an
// env-fed google-services.json path so the secret file is never committed:
// locally it falls back to ./google-services.json (gitignored); EAS builds get
// it from the GOOGLE_SERVICES_JSON file secret.
const appJson = require('./app.json');

module.exports = () => {
  const expo = appJson.expo;
  return {
    ...expo,
    android: {
      ...expo.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    },
    plugins: [
      ...(expo.plugins || []),
      '@react-native-firebase/app',
      'expo-image-picker',
      // Expo 54's toolchain supports Kotlin up to 2.2.20; pin to it (RNFirebase
      // 27 would otherwise default to 2.4.0, which KSP here can't resolve). The
      // Firebase BoM is patched down to 33.x so firebase-auth is built with a
      // Kotlin this toolchain can consume (see patches/).
      ['expo-build-properties', { android: { kotlinVersion: '2.2.20' } }],
    ],
  };
};
