import { Vibration, Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';

export class HapticFeedback {
  public static light() {
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light).catch(() => {
          Vibration.vibrate(10);
        });
      }
    } catch {
      Vibration.vibrate(10);
    }
  }

  public static medium() {
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium).catch(() => {
          Vibration.vibrate(25);
        });
      }
    } catch {
      Vibration.vibrate(25);
    }
  }

  public static success() {
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success).catch(() => {
          Vibration.vibrate([0, 30, 50, 30]);
        });
      }
    } catch {
      Vibration.vibrate(40);
    }
  }

  public static error() {
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error).catch(() => {
          Vibration.vibrate([0, 50, 50, 50]);
        });
      }
    } catch {
      Vibration.vibrate(80);
    }
  }
}
