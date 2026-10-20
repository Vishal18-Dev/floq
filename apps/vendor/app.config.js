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
      // Firebase's firebase-auth 25 is compiled with Kotlin 2.4; bump the
      // project Kotlin so it can consume that metadata (Expo 54 defaults to 2.1).
      ['expo-build-properties', { android: { kotlinVersion: '2.4.0' } }],
    ],
  };
};
