import * as Updates from 'expo-updates';

/**
 * True in the Google Play build. Play's Payments policy forbids taking or
 * pointing to non-Play payment for the subscription, so that build has no way
 * to pay in the app: an expired shop sees a neutral "inactive" screen.
 * Keyed off the EAS update channel, which is baked into the native build, so an
 * OTA update published for PhonePe Appstore/sideload can never re-enable the paywall here.
 */
export const IS_PLAY_BUILD = (() => {
  try {
    return Updates.channel === 'play';
  } catch {
    return false;
  }
})();
