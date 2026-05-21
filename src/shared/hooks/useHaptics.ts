import * as Haptics from 'expo-haptics';

export function useHaptics() {
  const impact = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const light = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  return { impact, light, success };
}
