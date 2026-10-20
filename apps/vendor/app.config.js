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
      // Pin Kotlin to the 2.1.x family Expo 54 is built for: RNFirebase 27 would
      // default to 2.4.0 (KSP can't resolve it) and 2.2.x breaks Expo's gradle
      // plugins (KotlinJvmCompilerOptions.getJvmDefault). The Firebase BoM is
      // patched down to 33.x so firebase-auth's metadata is 2.1-readable (patches/).
      ['expo-build-properties', { android: { kotlinVersion: '2.1.21' } }],
    ],
  };
};
